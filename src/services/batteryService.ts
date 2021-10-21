import { Subscription } from "../subscription"
import FlowIoService from "./service"

export class BatteryService implements FlowIoService {
    public static readonly id: string = "battery-service"
    public readonly id: string = BatteryService.id

    #batteryService: BluetoothRemoteGATTService | undefined
    #batteryLevelChr: BluetoothRemoteGATTCharacteristic | undefined
    #subscriptions: Subscription<number> = new Subscription<number>(["batterylevel"])

    public async init(bleServer: BluetoothRemoteGATTServer): Promise<void> {
        this.#batteryService = await bleServer.getPrimaryService("battery_service"); //uuid is 0x180F
        this.#batteryLevelChr = await this.#batteryService?.getCharacteristic("battery_level"); //uuid is 0x2A19

        //Subscribe to receive notifications from battery characteristic & add event listener to capture them.
        await this.#batteryLevelChr.startNotifications();
        this.#batteryLevelChr.addEventListener("characteristicvaluechanged", event => { //an event is returned
            const batLevel = (event.target as BluetoothRemoteGATTCharacteristic)?.value?.getUint8(0);
            if (batLevel != null) {
                this.#subscriptions.publish("batterylevel", batLevel)
            }
        });

        return this.getBatteryLevel().then(() => undefined);
    }

    public async getBatteryLevel(): Promise<number> {
        if (this.#batteryLevelChr == null) {
            return Promise.reject(`Call to getBatteryLevel before battery service was initialised`)
        }
        const batLevelDataView = await this.#batteryLevelChr.readValue(); //returns a DataView
        return batLevelDataView.getUint8(0);
    }

    public onBatteryLevelChanged(listener: (level: number) => void) {
        this.#subscriptions.subscribe('batterylevel', listener)
    }

    public removeBatteryLevelListener(listener: (level: number) => void) {
        this.#subscriptions.unsubscribe('batterylevel', listener)
    }

    public static readonly uuid: string = "battery_service" // Reserved name
    public readonly uuid: string = BatteryService.uuid
}