import FlowIoService from "./services/service"
import { Subscription } from "./subscription"

export const DEFAULT_SERVICES = ["generic_access"];

export const DEVICE_NAME_PREFIX = "FlowIO"; //Allow devices STARTING with this name

/**
 * @class FlowIo Represents a connection to a FlowIO device
 *
 * @constructor
 */
export class FlowIo<Services extends { [s: string]: FlowIoService }> {
    connection = new Subscription<Event>(["connected", "disconnected", "reconnectfailed"])

    readonly #services: Services
    #_bleDevice: BluetoothDevice | undefined
    #_bleServer: BluetoothRemoteGATTServer | undefined
    #_reconnectAttempts = 0
    #configuration: { maxReconnectAttempts: number }

    constructor(services: Services, maxReconnectAttempts: number = 3) {
        this.#configuration = {maxReconnectAttempts}
        this.#services = services
    }

    /**
     *
     * @param options Request a specific device or a device with specific services
     * @return {Promise<void>} resolves when connected to device and all services are initialised.
     */
    async connect(options: { namePrefix?: string, requestedServices?: string[] } = {
        namePrefix: DEVICE_NAME_PREFIX,
        requestedServices: undefined,
    }) {
        const deviceOptions: RequestDeviceOptions = {
            filters: [{namePrefix: options.namePrefix ? options.namePrefix : DEVICE_NAME_PREFIX}],
            optionalServices: options.requestedServices ?? Object.values(this.#services).map(service => service.uuid),
        };
        //the 'DEFAULT_SERVICES' is defined in the conditions.js file.
        try {
            this.#_bleDevice = await navigator.bluetooth.requestDevice(deviceOptions);
            this.#_bleDevice.addEventListener("gattserverdisconnected", event => {
                this.connection.publish("disconnected", event)
            }); //create and event listener for disconnect events.
            this.#_bleServer = await this.#_bleDevice.gatt?.connect();

            try {
                await this._initialiseServices();
                this.connection.publish("connected", new Event("flow-io-connected"))
                this.#_reconnectAttempts = 0;
            } catch (error) {
                this.connection.publish("disconnected", new Event("flow-io-services-uninitialised"))
                console.log(error)
                throw error
            }
        } catch (error) {
            this.connection.publish("disconnected", new Event("flow-io-connection-failed"))
            console.log(error)
            throw error
        }
    }

    async reconnect() {
        if (this.#_bleDevice != null && !this.#_bleServer?.connected) {
            try {
                this.#_bleServer = await this.#_bleDevice.gatt?.connect();
                await this._initialiseServices();
                this.connection.publish("connected", new Event("flow-io-connected"))
                this.#_reconnectAttempts = 0;
            } catch (error) {
                this.#_reconnectAttempts++;
                if (this.#_reconnectAttempts <= this.#configuration.maxReconnectAttempts) {
                    this.connection.publish("reconnectfailed", new Event("flow-io-services-uninitialised"))
                    await this.reconnect();
                } else {
                    this.connection.publish("disconnected", new Event("flow-io-connection-failed"))
                }
            }
        } else {
            await this.connect()
        }
    }

    disconnect() {
        if (this.#_bleDevice != null && this.#_bleServer?.connected) {
            this.#_bleServer?.disconnect()
            this.connection.publish("disconnected", new Event("flow-io-disconnect-requested"))
        }
    }

    isConnected() {
        return (this.#_bleDevice != null && this.#_bleServer?.connected)
    }

    async _initialiseServices() {
        if (this.#_bleServer != null) {
            return Promise.all(
                Object.values(this.services)
                      .map((service: FlowIoService) => service.init(this.#_bleServer!)),
            )
        } else {
            return Promise.reject("This FlowIO object is not connected to a device")
        }
    }

    get id(): string {
        return this.#_bleDevice?.id ?? "Unknown"
    }

    get name(): string {
        return this.#_bleDevice?.name ?? "Unknown"
    }

    get services() {
        return this.#services
    }
}