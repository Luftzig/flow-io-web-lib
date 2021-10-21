import { Subscription } from "../subscription"
import FlowIoService from "./service"

const powerOffServiceUUID = "0b0b0b0b-0b0b-0b0b-0b0b-00000000aa01";
const chrPowerOffTimerUUID = "0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa01";

const OFF_TIMER_DISABLED = 0xFF

export type PowerOffStatus
    = { kind: "off" }
    | { kind: "disabled" }
    | { kind: "remaining", minutes: number }

function numberToStatus(value: number): PowerOffStatus {
    switch (value) {
        case 0:
            return {kind: "off"}
        case OFF_TIMER_DISABLED:
            return {kind: "disabled"}
        default:
            return {kind: "remaining", minutes: value}
    }
}

export class PowerOffService implements FlowIoService {
    public static readonly id = "power-off-service"
    public readonly id: string = PowerOffService.id

    #bleServer: BluetoothRemoteGATTServer | undefined
    #bleService: BluetoothRemoteGATTService | undefined
    #powerOffTimerChr: BluetoothRemoteGATTCharacteristic | undefined
    #subscriptions: Subscription<PowerOffStatus> = new Subscription<PowerOffStatus>(["powerstatus"])

    public async init(device: BluetoothRemoteGATTServer): Promise<void> {
        this.#bleServer = device

        this.#bleService = await this.#bleServer.getPrimaryService(powerOffServiceUUID);
        this.#powerOffTimerChr = await this.#bleService.getCharacteristic(chrPowerOffTimerUUID);

        //Subscribe to receive the notifications
        await this.#powerOffTimerChr.startNotifications();
        this.#powerOffTimerChr.addEventListener("characteristicvaluechanged", event => {
            if (event.target == null) {
                throw new Error(`Malformed event received from ${this.#bleServer?.device.name}: missing target property`)
            }
            const minutesRemaining = (event.target as BluetoothRemoteGATTCharacteristic)?.value?.getUint8(0) ?? OFF_TIMER_DISABLED;
            this.#subscriptions.publish("powerstatus", numberToStatus(minutesRemaining))
        });

        return this.getRemainingTime().then(() => undefined) //this triggers a notification event. (Doesn't work without await!)
    }

    async getRemainingTime(): Promise<PowerOffStatus> {
        const minutesDataView = await this.#powerOffTimerChr?.readValue(); //returns a DataView
        const minutes = minutesDataView?.getUint8(0) ?? OFF_TIMER_DISABLED;
        return numberToStatus(minutes);
    }

    async setTimer(minutes: number | "disabled" | "off") {
        if (this.#powerOffTimerChr == null) {
            return Promise.reject("Call to setTimer before power off service was initialised")
        }
        if (minutes == 0 || minutes === "off") {
            const poweroff = new Uint8Array([0]);
            await this.#powerOffTimerChr.writeValue(poweroff);

        } else if (minutes === OFF_TIMER_DISABLED || minutes === "disabled") {
            await this.#powerOffTimerChr.writeValue(new Uint8Array([OFF_TIMER_DISABLED]));
        } else { //ignore the argument if not 0.
            const value = new Uint8Array([minutes]);
            await this.#powerOffTimerChr.writeValue(value);
        }
    }

    onStatusChanged(listener: (status: PowerOffStatus) => void) {
        this.#subscriptions.subscribe('powerstatus', listener)
    }

    removeStatusListener(listener: (status: PowerOffStatus) => void) {
        this.#subscriptions.unsubscribe('powerstatus', listener)
    }

    public static readonly uuid = powerOffServiceUUID
    public readonly uuid: string = PowerOffService.uuid
}