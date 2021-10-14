export default interface FlowIoService {
  readonly id: string,
  readonly uuid: string,
  init: (device: BluetoothRemoteGATTServer) => Promise<void>,
}