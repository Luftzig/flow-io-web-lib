export default interface FlowIoService {
  readonly name: string,
  readonly uuid: string,
  init: (device: BluetoothRemoteGATTServer) => Promise<void>,
}