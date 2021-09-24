/*
  This example shows how to control the state of each of the two LEDs on the nrf52832 Feather
  board. There is a characteristic that holds a 2-byte value, each byte corresponds to
  the state of an LED. The characteristic has a read and write permissions.
    In this JavaScript code, we are connecting to the device and reading the current value of
  the characteristic. Then we are toggling one of the two bytes depending on which button the
  user presses on the screen, which in turn causes the corresponding LED to toggle as well.
*/
'use strict'
const indicatorServiceUUID = '0b0b0b0b-0b0b-0b0b-0b0b-00000000aa02';
const chrLedStatesUUID     = '0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa02';
const chrErrorUUID         = '0b0b0b0b-0b0b-0b0b-0b0b-c2000000aa02';

listOfServices.push(indicatorServiceUUID); //appends this service to the array (defined in conditions.js).

//let indicatorService;
//let chrLedStates;
//let chrError;
//let ledStatesArray;
//let stateRed = true;
//let stateBlue = true;

async function initIndicatorService(flowio){
  try{
    flowio.indicatorService = await flowio.bleServer.getPrimaryService(indicatorServiceUUID);
    flowio.indicatorService.chrLedStates = await flowio.indicatorService.getCharacteristic(chrLedStatesUUID);
    flowio.indicatorService.chrError = await flowio.indicatorService.getCharacteristic(chrErrorUUID);

    //Subscribe to receive notifications from the chrError
    await flowio.indicatorService.chrError.startNotifications();
    flowio.indicatorService.chrError.addEventListener('characteristicvaluechanged', event => {
      flowio.log("FlowIO Error Code: " + event.target.value.getUint8(0));
    });

    //Subscribe to receive notifications from chrLedStates.
    await flowio.indicatorService.chrLedStates.startNotifications(); //This causes red LED to turn off
    //for unknown reasons having to do with the nrf52 bootloader or OS.
    flowio.indicatorService.chrLedStates.addEventListener('characteristicvaluechanged', event => {
      flowio.log("Notification: B=" + event.target.value.getUint8(1) + " R=" + event.target.value.getUint8(0));
    });
    flowio.log("indicator Service Initialized");

    //########################--- Define API Methods ---######################
    flowio.readError = async function(){
      let errorNumberDataView = await flowio.indicatorService.chrError.readValue(); //this will trigger our notification listener.
      let errorNumber = errorNumberDataView.getUint8(0);
      if(errorNumber!=0){
        document.querySelector(`#ok_btn${this.instanceNumber}`).style.display = "none";
        document.querySelector(`#error_btn${this.instanceNumber}`).style.display = "block";
      }
      else{
        document.querySelector(`#ok_btn${this.instanceNumber}`).style.display = "block";
        document.querySelector(`#error_btn${this.instanceNumber}`).style.display = "none";
      }
      return errorNumber;
    }
    flowio.clearError = async function(){
      let zeroArray = new Uint8Array([0]);
      await flowio.indicatorService.chrError.writeValue(zeroArray);
    }
    flowio.getLedStates = async function(){
      let valueDataView = await flowio.indicatorService.chrLedStates.readValue(); //returns a DataView and triggers a notification.
      //Set our LED state variables to match those in the characteristic:
      //We now convert the DataView to TypedArray so we can use array notation to access the data.
      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/buffer
      let ledStatesArray = new Uint8Array(valueDataView.buffer);
      flowio.ledBlue = ledStatesArray[1];
      flowio.ledRed = ledStatesArray[0];
    }
    flowio.toggleRed = async function(){
      flowio.ledRed = !flowio.ledRed;
      let ledStatesArray = new Uint8Array([flowio.ledRed,flowio.ledBlue]);
      await flowio.indicatorService.chrLedStates.writeValue(ledStatesArray);
    }
    flowio.toggleBlue = async function(){
      flowio.ledBlue = !flowio.ledBlue;
      let ledStatesArray = new Uint8Array([flowio.ledRed,flowio.ledBlue]);
      await flowio.indicatorService.chrLedStates.writeValue(ledStatesArray);
    }
    //########################################################################

    //Make read requests to trigger our notification funcion and to get initial values.
    flowio.getLedStates();
    flowio.readError();
  }
  catch(error){
    flowio.log("Init Error: " + error);
    throw "ERROR: initIndicatorService() failed.";
  }
}

// async function getLedStates(){
//   if (bleDevice && bleDevice.gatt.connected) {
//     let valueDataView = await chrLedStates.readValue(); //returns a DataView and
//     //triggers a notification. Hence, we don't need to log the value of 'val'
//     //here because we will get it in the event listener function above.
//     //(If you didn't know that object is of type "DataView" you could just do
//     //console.log(valueDataView) and then you will see all info about it in the console.
//
//     //Set our LED state variables to match those in the characteristic:
//     //We now convert the DataView to TypedArray so we can use array notation to access the data.
//     //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/buffer
//     ledStatesArray = new Uint8Array(valueDataView.buffer);
//     stateBlue = ledStatesArray[1];
//     stateRed = ledStatesArray[0];
//   }
//   else log("Device not connected");
// }
// async function readError(){
//   if (bleDevice && bleDevice.gatt.connected) {
//     await chrError.readValue(); //this will trigger our notification listener.
//   }
//   else log("Device not connected");
// }
// async function clearError(){
//   if (bleDevice && bleDevice.gatt.connected) {
//     let zeroArray = new Uint8Array([0]);
//     await chrError.writeValue(zeroArray);
//   }
//   else log("Device not connected");
// }
// async function toggleRed(){
//   if (bleDevice && bleDevice.gatt.connected) {
//     ledStatesArray[0] = (stateRed) ? 0x00 : 0x01;
//     stateRed = !stateRed;
//     await chrLedStates.writeValue(ledStatesArray);
//   }
//   else log("Device not connected");
// }
// async function toggleBlue(){
//   if (bleDevice && bleDevice.gatt.connected) {
//     ledStatesArray[1] = (stateBlue) ? 0x00 : 0x01;
//     stateBlue = !stateBlue;
//     await chrLedStates.writeValue(ledStatesArray);
//   }
//   else log("Device not connected");
// }
