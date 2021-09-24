/* This example powers off the flowio device and sets the power off timer.
*/
'use strict'
const powerOffServiceUUID = '0b0b0b0b-0b0b-0b0b-0b0b-00000000aa01';
const chrPowerOffTimerUUID = '0b0b0b0b-0b0b-0b0b-0b0b-c1000000aa01';

listOfServices.push(powerOffServiceUUID); //appends this service to the array (defined in conditions.js).

async function initPowerOffService(flowio){
  try{
    //NOTE: If we make these immutable, we can't have the reconnect feature because we must reinvoke this function on reconnect.
    flowio.powerOffService = await flowio.bleServer.getPrimaryService(powerOffServiceUUID);
    flowio.powerOffService.chrPowerOffTimer = await flowio.powerOffService.getCharacteristic(chrPowerOffTimerUUID);

    //Subscribe to receive the notifications
    await flowio.powerOffService.chrPowerOffTimer.startNotifications();
    flowio.powerOffService.chrPowerOffTimer.addEventListener('characteristicvaluechanged', event => {
      let remainingTime = event.target.value.getUint8(0);
      if(remainingTime==0xFF){
        document.getElementById(`minremaining${flowio.instanceNumber}`).innerHTML = '';
        document.getElementById(`minremaining${flowio.instanceNumber}`).disabled = true;
        flowio.log("AutoOFF Disabled");
      }
      else if(remainingTime==0x00){ //becomes true ONLY when we PRESS the power button, not when timer reaches 0 naturally. OK.
        document.getElementById(`minremaining${flowio.instanceNumber}`).innerHTML = 'OFF';
        document.getElementById(`minremaining${flowio.instanceNumber}`).disabled = true;
        flowio.log("Power OFF");
      }
      else{
        document.getElementById(`minremaining${flowio.instanceNumber}`).innerHTML = '00:0' + remainingTime;
        // document.getElementById(`minremaining${flowio.instanceNumber}`).innerHTML = remainingTime + '<span class="smallfont">min</span>';
        document.getElementById(`minremaining${flowio.instanceNumber}`).disabled = false;
        flowio.log('Remaining time: ' + remainingTime);
      }
    });
    flowio.log("PowerOff Service Initialized");

    //########################--- Define API Methods ---######################
    flowio.getRemainingTime = async function(){
      let minutesDataView = await flowio.powerOffService.chrPowerOffTimer.readValue(); //returns a DataView
      let minutes = minutesDataView.getUint8(0);
      return minutes;
    }
    flowio.setTimer = async function(min){
      if(min==0){
        // flowio.log('Power off'); //We have this in the event listener.
        let poweroff = new Uint8Array([0]);
        await flowio.powerOffService.chrPowerOffTimer.writeValue(poweroff);
        flowio.disableControls();
      }
      else{ //ignore the argument if not 0.
        let val = document.getElementById(`autoOff_select${flowio.instanceNumber}`).value;
        let valArray = new Uint8Array([val]);
        await flowio.powerOffService.chrPowerOffTimer.writeValue(valArray);
      }
    }
    //########################---END: Define API Methods ---######################

    let initTimer = await flowio.getRemainingTime(); //this triggers a notification event. (Doesn't work without await!)
    document.querySelector(`#autoOff_select${flowio.instanceNumber}`).selectedIndex = initTimer; //sets the selector box to the initTimer value.
  }
  catch(error){
    flowio.log("FlowIO initPowerOffService() error :( " + error);
    throw "FlowIO initPowerOffService() error :( ";
  }
}
