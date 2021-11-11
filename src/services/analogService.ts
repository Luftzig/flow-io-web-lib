/*This examples shows how to read 16-bit integer values from a characteristic, and how to write
commands of different byte size back to the same characteristic.

I should just have checkmarks where I can select which channels I want to read from, just like I have for the pneumatic channels.
This would simplify things, especially when a user wants to use more than 1 but fewer than 16 channels. This will require a modification to the
embedded code however. Currently, the embedded code only read all 16 channels, and sends the result. It cannot read fewer than that.
I want a characteristic that would read only the channels I care about reading. But how would I set it up? I

The API has the following methods and constants:

  flowios[0].analogService
  flowios[0].analogService.chrAnalogValues16

  flowios[0].analog
  flowios[0].analog.numberOfSamples
  flowios[0].analog.setNumberOfSamples() //takes the value from the selector in the GUI
  flowios[0].analog.getValue() //returns the analaog value. We don't use this in the GUI, but good to have in the API
  flowios[0].analog.requestRead16()
  flowios[0].analog.requestRead16Continuous()
  flowios[0].analog.getValues16()
  flowios[0].analog.stopReadContinuous() //send the stop singnal (can be sent to either characteristic because the value is chared in the embedded code)

Methods not yet implemented but under consideration:
  flowios[0].analogService.chrAnalogValue
  flowios[0].analog.channel //not yet implemented
  flowios[0].analog.setAnalogChannel() //takes the value from the selector in the GUI. Not yet implemented.
  flowios[0].analog.requestReadSingle() //sends a request for one value from the channel in .channel
  flowios[0].analog.requestReadSingleContinuous() // sends a request for continuous reading of moving average from the channel in .channel over .numberOfSamples samples.
*/
import { Subscription } from "../subscription"
import FlowIoService from "./service"

const analogServiceUUID = "0b0b0b0b-0b0b-0b0b-0b0b-00000000aa07";
const chrAnalogValues16UUID = "0b0b0b0b-0b0b-0b0b-0b0b-c2000000aa07";

const STOP_CODE = 0x00
const SINGLE_VALUE_CODE = 0x01
const CONTINUOUS_VALUE_CODE = 0x02

class AnalogService implements FlowIoService {
    static readonly id = "analog-service"
    public readonly id: string = AnalogService.id
    static readonly uuid = analogServiceUUID
    public readonly uuid: string = AnalogService.uuid
    // These are initialised in `init` so we tell the compiler that
    #service!: BluetoothRemoteGATTService
    #values!: BluetoothRemoteGATTCharacteristic
    #subscriptions: Subscription<Array<number>> = new Subscription<Array<number>>(["data"])
    #averagingWindowSampleSize: number = 1

    public async init(bleServer: BluetoothRemoteGATTServer): Promise<void> {
        this.#service = await bleServer.getPrimaryService(AnalogService.uuid)
        this.#values = await this.#service.getCharacteristic(chrAnalogValues16UUID)

        this.#values.addEventListener("characteristicvaluechanged", ({target}) => {
            const values = (target as BluetoothRemoteGATTCharacteristic)?.value
            if (values != null && values.byteLength === (16*2)) {
                const asNumbers = [...Array(16).keys()].map(index => values.getUint16(index * 2, true))
                this.#subscriptions.publish("data", asNumbers)
            } else {
                console.warn("Attempted to read analog values, but found", values)
            }
        })
        await this.#values.startNotifications()
        return Promise.resolve(undefined);
    }

    public async requestValues(mode: "stop" | "single" | "continuous", averagingWindowSizeSamples?: number ) {
        switch (mode) {
            case "stop":
                return this.#values.writeValue(new Uint8Array([STOP_CODE]))
            case "single":
                return this.#values.writeValue(new Uint8Array([SINGLE_VALUE_CODE]))
            case "continuous":
                this.#averagingWindowSampleSize = averagingWindowSizeSamples ?? this.#averagingWindowSampleSize
                return this.#values.writeValue(new Uint8Array([CONTINUOUS_VALUE_CODE, this.#averagingWindowSampleSize]))
        }
    }

    get averagingWindowSampleSize() { return this.#averagingWindowSampleSize}
}
