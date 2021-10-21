export default interface FlowIoService {
  readonly id: string,
  readonly uuid: string,
  init: (bleServer: BluetoothRemoteGATTServer) => Promise<void>,
}