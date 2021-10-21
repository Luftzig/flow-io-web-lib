import FlowIoService from "./service"

const configServiceUUID = "0b0b0b0b-0b0b-0b0b-0b0b-00000000aa03";
const chrConfigUUID = "0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa03";

type FlowIOConfiguration
    = 'GENERAL'
    | 'INFLATION_SERIES'
    | 'INFLATION_PARALLEL'
    | 'VACUUM_SERIES'
    | 'VACUUM_PARALLEL'


function configurationToCode(configuration: FlowIOConfiguration): number {
    switch (configuration) {
        case "GENERAL":
            return 0
        case "INFLATION_SERIES":
            return 1
        case "INFLATION_PARALLEL":
            return 2
        case "VACUUM_SERIES":
            return 3
        case "VACUUM_PARALLEL":
            return 4
    }
}

function codeToConfiguration(code: number): FlowIOConfiguration | undefined {
    switch (code) {
        case 0:
            return 'GENERAL'
        case 1:
            return 'INFLATION_SERIES'
        case 2:
            return 'INFLATION_PARALLEL'
        case 3:
            return 'VACUUM_SERIES'
        case 4:
            return 'VACUUM_PARALLEL'
        default:
            return undefined
    }
}

class ConfigService implements FlowIoService {
    public static readonly id = "config-service"
    public readonly id: string = ConfigService.id

    #bleServer: BluetoothRemoteGATTServer | undefined
    #bleService: BluetoothRemoteGATTService | undefined
    #configChr: BluetoothRemoteGATTCharacteristic | undefined

    public async init(device: BluetoothRemoteGATTServer): Promise<void> {
        //NOTE: If we make these immutable, we can't have the reconnect feature because we must reinvoke this function on reconnect.
        this.#bleServer = device
        this.#bleService = await device.getPrimaryService(configServiceUUID);
        this.#configChr = await this.#bleService.getCharacteristic(chrConfigUUID);
        return this.getConfiguration().then(_ => undefined);
    }

    async getConfiguration(): Promise<FlowIOConfiguration> {
        const config = await this.#configChr?.readValue(); //this returns a DataView
        const configNumber = config?.getUint8(0);
        if (configNumber == null) throw new Error(`Failed to read configuration from ${this.#bleServer?.device.name}. Configuration service is not available or did not return a value.`)
        const configuration = codeToConfiguration(configNumber)
        if (configuration == null) throw new Error(`Unrecognised configuration code ${configNumber} received from ${this.#bleServer?.device.name}`)
        return configuration
    }

    async setConfiguration (configuration: FlowIOConfiguration) {
        const valArray = new Uint8Array([configurationToCode(configuration)]);
        if (this.#configChr == null) throw new Error(`Tried to set configuration for ${this.#bleServer?.device.name}, but service is not available.`)
        await this.#configChr.writeValue(valArray);
    }

    public static readonly uuid: string = configServiceUUID
    public readonly uuid: string = ConfigService.uuid
}