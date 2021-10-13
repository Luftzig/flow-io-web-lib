// @flow
/* The ascii character hex equivalencies are:
  ! = 0x21 -- stop
  + = 0x2b -- inflation
  - = 0x2d -- vacuum
  ^ = 0x5e -- release
  ? = 0x3f -- pressure
  p = 0x70
  n = 0x6e

  This API has the following methods and constants:

  flowios[0].controlService
  flowios[0].controlService.chrCommand
  flowios[0].controlService.chrHardwareStatus

  flowios[0].status
  flowios[0].status.active
  flowios[0].status.hardwareStatus
  flowios[0].status.pump1
  flowios[0].status.pump2
  flowios[0].status.inlet
  flowios[0].status.outlet
  flowios[0].status.port1
  flowios[0].status.port2
  flowios[0].status.port3
  flowios[0].status.port4
  flowios[0].status.port5

  flowios[0].getHardwareStatus()
  flowios[0].writeCommand(what,where,how=MAXPWM)
  flowios[0].commandArray[what,where,how]
  flowios[0].startInflation(where,how=flowio.pump1PWM)
  flowios[0].startVacuum (where,how=flowio.pump2PWM)
  flowios[0].startRelease(where)
  flowios[0].stopAction(where)
  flowios[0].stopAllActions()
  flowios[0].setPump1PWM(pwmValue)
  flowios[0].setPump2PWM(pwmValue)
*/
import FlowIoService from "./service"
import { Subscription } from "../subscription"

const STOP = 0x21;
const INFLATION = 0x2b;
const VACUUM = 0x2d;
const RELEASE = 0x5e;
const INFLATION_HALF = 0x70;
const VACUUM_HALF = 0x6e;
//------------
const ALLPORTS = 0xff;
const PUMP_MAX_PWM = 0xff;
//-----------------------------------------------------
"use strict"
const controlServiceUUID = "0b0b0b0b-0b0b-0b0b-0b0b-00000000aa04";
const chrCommandUUID = "0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa04";
const chrHardwareStatusUUID = "0b0b0b0b-0b0b-0b0b-0b0b-c2000000aa04";

// listOfServices.push(controlServiceUUID); //appends this service to the array (defined in conditions.js).

type FlowIOAction = FlowIOActionString | FlowIOActionCode

type FlowIOActionString = "inflate" | "vacuum" | "release" | "stop"
    | "inflate-half" | "vacuum-half" // TODO: Are these two supported?

type FlowIOActionCode
    = /* STOP */0x21
    | /* INFLATION */0x2b
    | /* VACUUM */0x2d
    | /* RELEASE */0x5e
    | /* INFLATION_HALF */0x70
    | /* VACUUM_HALF */0x6e;

type FlowIOPortsState
    =
    { port1: boolean, port2: boolean, port3: boolean, port4: boolean, port5: boolean, inlet?: boolean, outlet?: boolean }
    | number

export interface FlowIOControlCommand {
    action: FlowIOAction,
    ports: FlowIOPortsState,
    pumpPwm: number
}

export class HardwareStatus {
    readonly _raw: string
    readonly pump1: boolean
    readonly pump2: boolean
    readonly inlet: boolean
    readonly outlet: boolean
    readonly port1: boolean
    readonly port2: boolean
    readonly port3: boolean
    readonly port4: boolean
    readonly port5: boolean
    readonly active: boolean

    constructor(eventOrDataViewOrDefault?: Event | DataView) {
        if (eventOrDataViewOrDefault == null) {
            this._raw = ""
            this.pump1 = false
            this.pump2 = false
            this.inlet = false
            this.outlet = false
            this.port1 = false
            this.port2 = false
            this.port3 = false
            this.port4 = false
            this.port5 = false
            this.active = false
        } else {
            //We want all status object-variables to be changed in the event listener, as soon as they
            //change in the hardware. Not inside the getHardwareStatus() function because there may be
            //a change in the hardware status even if we don't invoke this function.
            /* $FlowFixMe[type-incompatible]: We know that types are correct  */
            const value: DataView = (eventOrDataViewOrDefault instanceof Event)
                // @ts-ignore
                ? ((eventOrDataViewOrDefault as Event).target?.value)
                : eventOrDataViewOrDefault

            this._raw = value.getUint16(0, true).toString(16); //true causes the endicanness to be correct.
            const byte0 = value.getUint8(0);
            const byte1 = value.getUint8(1);
            this.pump1 = !!(byte0 >> 7 & 0x01);
            this.pump2 = !!(byte1 & 0x01);
            this.inlet = !!(byte0 >> 5 & 0x01);
            this.outlet = !!(byte0 >> 6 & 0x01);
            this.port1 = !!(byte0 >> 0 & 0x01);
            this.port2 = !!(byte0 >> 1 & 0x01);
            this.port3 = !!(byte0 >> 2 & 0x01);
            this.port4 = !!(byte0 >> 3 & 0x01);
            this.port5 = !!(byte0 >> 4 & 0x01);

            //Create a status active / inactive flag that we can later use in our pressure service when choosing if a pressure value should be assigned to a port.
            this.active = byte0 !== 0
        }
    }
}


function toCommandCode(action: FlowIOAction): FlowIOActionCode {
    if (typeof action === "number") {
        // We assume that the typechecker will warn us if we use the wrong code
        return (action as FlowIOActionCode)
    }
    switch (action) {
        case "inflate":
            return INFLATION
        case "vacuum":
            return VACUUM
        case "release":
            return RELEASE
        case "stop":
            return RELEASE
        case "inflate-half":
            return INFLATION_HALF
        case "vacuum-half":
            return VACUUM_HALF
        default:
            return STOP
    }
}

function toPortsCode(ports: FlowIOPortsState) {
    if (typeof ports === "object") {
        return (ports.port1 ? 0x01 : 0)
               + (ports.port2 ? 0x02 : 0)
               + (ports.port3 ? 0x04 : 0)
               + (ports.port4 ? 0x08 : 0)
               + (ports.port5 ? 0x10 : 0)
               + (ports.inlet ? 0x20 : 0)
               + (ports.outlet ? 0x40 : 0)
    } else {
        return ports
    }
}

export default class ControlService implements FlowIoService {
    name = "control-service"
    static uuid = controlServiceUUID
    uuid = ControlService.uuid
    #service: BluetoothRemoteGATTService | undefined
    #command: BluetoothRemoteGATTCharacteristic | undefined
    #hardwareState: BluetoothRemoteGATTCharacteristic | undefined
    lastCommand: FlowIOControlCommand | undefined
    #subscription = new Subscription<HardwareStatus | FlowIOControlCommand | Error>([
                                                                                        "status",
                                                                                        "command-sent",
                                                                                        "command-failed",
                                                                                    ])
    #pumpPWMStatus: { pump1: number, pump2: number } = {pump1: NaN, pump2: NaN}

    status: HardwareStatus = new HardwareStatus()

    async init(bleServer: BluetoothRemoteGATTServer) {
        try {
            this.#service = await bleServer.getPrimaryService(controlServiceUUID)
            this.#command = await this.#service.getCharacteristic(chrCommandUUID)
            this.#hardwareState = await this.#service.getCharacteristic(chrHardwareStatusUUID)
            await this.#hardwareState.startNotifications()
            this.#hardwareState.addEventListener("characteristicvaluechanged", (event) => {
                this.status = new HardwareStatus(event)
                this.#subscription.publish("status", this.status);
            })
            return this.checkHardwareStatus().then(() => {
            })
        } catch (error) {
            throw new Error(`ControlService initialisation failed due to: ${error}`)
        }
    }

    onStatusUpdated(listener: (status: HardwareStatus) => void) {
        // @ts-ignore
        this.#subscription.subscribe("status", listener)
    }

    removeStatusListener(listener: (status: HardwareStatus) => void) {
        // @ts-ignore
        this.#subscription.unsubscribe("status", listener)
    }

    onCommandSent(listener: (command: FlowIOControlCommand) => void) {
        // @ts-ignore
        this.#subscription.subscribe("command-sent", listener)
    }

    removeCommandSentListener(listener: (command: FlowIOControlCommand) => void) {
        // @ts-ignore
        this.#subscription.unsubscribe("command-sent", listener)
    }

    onCommandFailed(listener: (error: Error) => void) {
        // @ts-ignore
        this.#subscription.subscribe("command-failed", listener)
    }

    removeCommandFailedListener(listener: (error: Error) => void) {
        // @ts-ignore
        this.#subscription.unsubscribe("command-failed", listener)
    }

    checkHardwareStatus() {
        return this.#hardwareState
            ? (this.#hardwareState.readValue().then(data => new HardwareStatus(data)))
            : Promise.reject("service not initialised")
    }

    async sendCommand(command: FlowIOControlCommand) {
        //TODO: Make the commandArray 4-bytes after you change the communication protocol to be 4-bytes.
        const {action, ports, pumpPwm} = command
        this.lastCommand = command
        const actionCode = toCommandCode(action)
        const portsCode = toPortsCode(ports)
        const commandArray = new Uint8Array([actionCode, portsCode, pumpPwm]); //Always holds the last command written.
        //All action methods are in terms of the writeCommand() method so this is updated automatically.
        //if the third byte is 255, then we are going to send only the first 2bytes to the FlowIO to save time and bandwidth.
        if (pumpPwm === PUMP_MAX_PWM) { //in this case only send an array of 2-bytes.
            const array2byte = new Uint8Array([actionCode, portsCode]);
            await this.#command?.writeValueWithoutResponse(array2byte)
                      .then(() => this.#subscription.publish("command-sent", command))
                      .catch(e => {
                          this.#subscription.publish("command-failed", e);
                          throw e
                      })

        } else {
            await this.#command?.writeValueWithoutResponse(commandArray)
                      .then(() => this.#subscription.publish("command-sent", command))
                      .catch(e => {
                          this.#subscription.publish("command-failed", e);
                          throw e
                      })
        }
    }

    //TODO: After I start using the 4-byte protocol, I should add a 4th optional argument to the action methods.
    //TODO: Add the halfcapacity functions to the API.
    // async startInflation(where, how = flowio.pump1PWM) { //set default value to the pump1pwm flag.
    //   await flowio.writeCommand(INFLATION, where, how);
    // }
    //
    async startVacuum(ports: FlowIOPortsState, pumpPwm = this.#pumpPWMStatus.pump1) {
        await this.sendCommand({action: VACUUM, ports: ports, pumpPwm });
    }

    async startRelease(ports: FlowIOPortsState) {
        await this.sendCommand({action: RELEASE, ports, pumpPwm: 0 });
    }

    async stopAction(ports: FlowIOPortsState) {
        await this.sendCommand({action: STOP, ports, pumpPwm: 0});
    }

    async stopAllActions() {
        await this.sendCommand({action: STOP, ports: ALLPORTS, pumpPwm: 0});
    }

    async setPump1PWM(pwmValue: number) {       //we will invoke this function every time the pump1 slider changes.
        this.#pumpPWMStatus.pump1 = pwmValue;
        if (this.status.pump1) {
            await this._setPumpPwmValue(pwmValue)
        }
    }

    async setPump2PWM(pwmValue: number) {       //we will invoke this function every time the pump1 slider changes.
                                                //send the same command as the previous one, but only change the pwmValue. Only send command if pump1 is ON.
        this.#pumpPWMStatus.pump2 = pwmValue;
        if (this.status.pump2) {
            await this._setPumpPwmValue(pwmValue)
        }
    }

    async _setPumpPwmValue(pwmValue: number) {
        try {
            if (this.lastCommand != null) {
                await this.sendCommand({
                                           action: this.lastCommand.action,
                                           ports: this.lastCommand.ports,
                                           pumpPwm: pwmValue,
                                       });
            }
        } catch (error) {
            //Display error only if different from this one. Is there a more elegant way
            //to check id device is busy and then simply not send the write request, rather
            //than waiting for an error to tell me this?
            if ((error as Error).message !== "GATT operation already in progress.") {
                console.log(error);
                throw error;
            }
        }
    }
}
