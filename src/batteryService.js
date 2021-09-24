/*
  This example reports battery level changes. It uses an event listener that triggers whenver
  the BLE device sends a notification from the battery level characteristic. It also shows the
  time when the event has occurred. There are many other googies you can find in the `event` object,
  which is returned when the event fires.
    The user also has the ability to read the current in the characteristic at any time.
*/

'use strict'

listOfServices.push('battery_service'); //appends this service to the array (defined in conditions.js).

async function initBatteryService(flowio){
  try{
    //NOTE: If we make these immutable, we can't have the reconnect feature becase we must reinvoke this function on reconnect.
    flowio.batteryService = await flowio.bleServer.getPrimaryService('battery_service'); //uuid is 0x180F
    flowio.batteryService.chrBatteryLevel = await flowio.batteryService.getCharacteristic('battery_level'); //uuid is 0x2A19

    //Subscribe to receive notifications from battery characteristic & add event listener to capture them.
    await flowio.batteryService.chrBatteryLevel.startNotifications();
    flowio.batteryService.chrBatteryLevel.addEventListener('characteristicvaluechanged', event => { //an event is returned
      flowio.log(event.target.value.getUint8(0)+'%');
      let batLevel = event.target.value.getUint8(0);
      //Show the icon corresponding to the correct battery range:
      //NOTE: We don't want to use the .className approah, because that replaces ALL the classes with the ones we specify, and thus if we change or add
      //a class to the HTML, we must also make the exact change here, which would be a bad practice. Therefore, we instead use the .classList approach below
      //even though it uses a little bit more code.
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-100');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-80');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-60');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-40');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-20');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-10');
      document.getElementById(`batt_refresh_btn${flowio.instanceNumber}`).classList.remove('icon-battery-0');

      if(batLevel>90) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-100');
      else if(batLevel>70) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-80');
      else if(batLevel>50) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-60');
      else if(batLevel>30) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-40');
      else if(batLevel>15) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-20');
      else if(batLevel>5) document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-10');
      else document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).classList.add('icon-battery-0');
      //Show the battery level in the tooltip:
      document.querySelector(`#batt_refresh_btn${flowio.instanceNumber}`).title = batLevel + '%';
      //console.log(event); //we can use this in the console to see all the goodies in the event object.
    });
    flowio.log("Battery Service Initialized");
    //To print the battery level, we simply make a read request, and that triggers
    //a notification to be sent by the device. So we don't even need to capture the
    //returned value to display it manually; just reading it is enough.

    //########################--- Define API Methods ---######################
    flowio.getBatteryLevel = async function(){
      let batLevelDataView = await flowio.batteryService.chrBatteryLevel.readValue(); //returns a DataView
      //we don't need it because it also triggers the 'characteristicvaluechanged' notification.
      return batLevelDataView.getUint8(0);
    }
    //########################--- END: Define API Methods ---######################

    await flowio.getBatteryLevel(); //invoke once to obtain an event.
  }
  catch(error){
    flowio.log("FlowIO initBatteryService() error :( " + error); //NOTE: When we catch the error, execution will
    //continue and this error will not be visible by anyone who called initBatteryService().
    //Thus, to make the caller aware that initBatteryService() gave an arror, we must
    ///raise owr own error here.
    throw "FlowIO initBatteryService() error :(.";
    //Anything we put here after "throw" line will not get executed.
  }
}
