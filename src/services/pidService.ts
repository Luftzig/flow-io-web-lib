import { FlowIOActionString, FlowIOPortsState, fromCommandCode, toCommandCode, toPortsCode } from "./controlService"
import FlowIoService from "./service"

// [0x08, 0xaa, 0x00, 0x00, 0x00, 0x00, 0x0b, 0x0b,
// 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b]
const pidControlUUID
    = "0b0b0b0b-0b0b-0b0b-0b0b-00000000aa08"

// [ 0x08, 0xaa, 0x00, 0x00, 0x00, 0xc1, 0x0b, 0x0b,
//   0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
// ]
const chrPidSettings16UUID
    = "0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa08"

// [
// 0x08, 0xaa, 0x00, 0x00, 0x00, 0xc2, 0x0b, 0x0b,
// 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
// ]
const chrPidGoals16UUID
    = "0b0b0b0b-0b0b-0b0b-0b0b-c2000000aa08"

type PidControlsTuple = [PidControl, PidControl, PidControl, PidControl, PidControl]

type PidGoalsTuple = [number, number, number, number, number]

class PidSettings {
    positiveCommand: FlowIOActionString
    negativeCommand: FlowIOActionString
    controls: PidControlsTuple

    constructor(positiveCommand: FlowIOActionString = "inflate",
                negativeCommand: FlowIOActionString = "release",
                controls: PidControlsTuple
                    = [
                    PidControl.disabled(),
                    PidControl.disabled(),
                    PidControl.disabled(),
                    PidControl.disabled(),
                    PidControl.disabled(),
                ]) {
        this.positiveCommand = positiveCommand
        this.negativeCommand = negativeCommand
        this.controls = controls
    }

    public serialize(): Blob {
        const view = new DataView(new ArrayBuffer(2))
        view.setUint8(0, toCommandCode(this.positiveCommand))
        view.setUint8(1, toCommandCode(this.negativeCommand))
        return new Blob([view.buffer, ...this.controls.map(c => c.serialize())])
    }

    static async from(blob: Blob): Promise<PidSettings> {
        const buffer = await blob.arrayBuffer()
        const view = new DataView(buffer)
        const controls = [...Array(5).keys()]
            .map(i => buffer.slice(2 + (i * PidControl.memorySize), 2 + ((i + 1) * PidControl.memorySize)))
            .map(slice => PidControl.from(slice))
        const positiveCommand = fromCommandCode(view.getUint8(0))
        const negativeCommand = fromCommandCode(view.getUint8(1))
        return new PidSettings(positiveCommand, negativeCommand, controls as PidControlsTuple)
    }
}

class PidControl {
    proportional: number
    integrative: number
    differential: number
    inputChannel: number
    outputPort: FlowIOPortsState

    constructor(inputChannel: number,
                outputPort: FlowIOPortsState,
                proportional = 0,
                integrative = 0,
                differential = 0) {
        this.inputChannel = inputChannel > 0 && inputChannel <= 16 ? inputChannel : 0
        this.outputPort = outputPort
        this.proportional = proportional
        this.integrative = integrative
        this.differential = differential
    }

    static disabled(): PidControl {
        return new PidControl(0, 0)
    }

    serialize(): ArrayBufferLike {
        const buffer = new ArrayBuffer(2 + (32 * 3))
        const view = new DataView(buffer)
        view.setFloat32(0, this.proportional)
        view.setFloat32(4, this.integrative)
        view.setFloat32(8, this.differential)
        view.setUint8(12, this.inputChannel)
        view.setUint8(13, toPortsCode(this.outputPort))
        return buffer
    }

    static from(buffer: ArrayBufferLike): PidControl {
        const view = new DataView(buffer)
        const control = new PidControl(0, 0)
        control.proportional = view.getFloat32(0)
        control.integrative = view.getFloat32(4)
        control.differential = view.getFloat32(8)
        control.inputChannel = view.getUint8(12)
        control.outputPort = view.getUint8(13)
        return control
    }

    /** The number of bytes needed for serializing
     */
    static readonly memorySize = 14;
}

export class PidService implements FlowIoService {
    static readonly id = "pid-service"
    public readonly id: string = PidService.id
    static readonly uuid = pidControlUUID
    public readonly uuid: string = PidService.uuid

    #service!: BluetoothRemoteGATTService
    #settings!: BluetoothRemoteGATTCharacteristic
    #goals!: BluetoothRemoteGATTCharacteristic

    public async init(bleServer: BluetoothRemoteGATTServer): Promise<void> {
        this.#service = await bleServer.getPrimaryService(PidService.uuid)
        this.#settings = await this.#service.getCharacteristic(chrPidSettings16UUID)
        this.#goals = await this.#service.getCharacteristic(chrPidGoals16UUID)

        await this.#settings.readValue()
        await this.#goals.readValue()
    }

    public getSettings(): Promise<PidSettings> {
        return this.#settings.readValue()
                   .then(view => new Blob([view.buffer]))
                   .then(PidSettings.from)
    }

    public setSettings(settings: PidSettings): Promise<void> {
        return settings.serialize().arrayBuffer()
                       .then(buffer => this.#settings.writeValue(buffer))
    }

    public getGoals(): Promise<PidGoalsTuple> {
        return this.#goals.readValue()
                   .then(view => [
                       view.getUint16(0),
                       view.getUint16(2),
                       view.getUint16(4),
                       view.getUint16(6),
                       view.getUint16(8),
                   ])
    }

    public setGoals(goals: PidGoalsTuple): Promise<void> {
        const buffer = new ArrayBuffer(10)
        const view = new DataView(buffer)
        view.setUint16(0, goals[0])
        view.setUint16(2, goals[1])
        view.setUint16(4, goals[2])
        view.setUint16(6, goals[3])
        view.setUint16(8, goals[4])
        return this.#goals.writeValue(buffer)
    }
}