/*This example allows you to read and receive a notifications from a BLE device
that reports a floating point value (4-byte).

The default value reported has many digits after the decimal point, which are
not true, thus we are trunkating the value to just 5 digits.

*/
'use strict'
const pressureServiceUUID      = '0b0b0b0b-0b0b-0b0b-0b0b-00000000aa05';
const chrPressureValueUUID     = 0X2A6D;
//const chrPressureRequestUUID   = '0b0b0b0b-0b0b-0b0b-0b0b-c2000000aa05';
const chrMaxPressureLimitsUUID = '0b0b0b0b-0b0b-0b0b-0b0b-c3000000aa05';
const chrMinPressureLimitsUUID = '0b0b0b0b-0b0b-0b0b-0b0b-c4000000aa05';

listOfServices.push(pressureServiceUUID); //appends this service to the array (defined in conditions.js).

async function initPressureService(flowio) {
  try{
    flowio.pressureService = await flowio.bleServer.getPrimaryService(pressureServiceUUID);
    flowio.pressureService.chrPressureValue = await flowio.pressureService.getCharacteristic(chrPressureValueUUID);
    //TODO: Remove the following characteristic entirely.
    //flowio.pressureService.chrPressureRequest = await flowio.pressureService.getCharacteristic(chrPressureRequestUUID);
    flowio.pressureService.chrMaxPressureLimits = await flowio.pressureService.getCharacteristic(chrMaxPressureLimitsUUID);
    flowio.pressureService.chrMinPressureLimits = await flowio.pressureService.getCharacteristic(chrMinPressureLimitsUUID);

    //Subscribe to receive notifications about the pressure value.
    await flowio.pressureService.chrPressureValue.startNotifications();
    flowio.pressureService.chrPressureValue.addEventListener('characteristicvaluechanged', event => { //an event is returned
      let floatValue = event.target.value.getFloat32(0,true); //the 'true' is for the endianness.
      floatValue = floatValue.toFixed(3); //rounding to 4 decimal places.
      flowio.pressure.lastvalue = floatValue;

      if(typeof(flowio.status) != "undefined" && flowio.status.active){ //check if the object exists first.
        if(flowio.status.port1) flowio.pressure.port1 = flowio.pressure.lastvalue;
        if(flowio.status.port2) flowio.pressure.port2 = flowio.pressure.lastvalue;
        if(flowio.status.port3) flowio.pressure.port3 = flowio.pressure.lastvalue;
        if(flowio.status.port4) flowio.pressure.port4 = flowio.pressure.lastvalue;
        if(flowio.status.port5) flowio.pressure.port5 = flowio.pressure.lastvalue;
        flowio.log("P1=" + flowio.pressure.port1 + "\tP2=" + flowio.pressure.port2 + "\tP3=" + flowio.pressure.port3 + "\tP4=" + flowio.pressure.port4 + "\tP5=" + flowio.pressure.port5)
      }
      else{
        flowio.log("P = " + floatValue);
        //The last pressure value I read occurs, for some reason, after the device is deactivated.That's why it's critically important that I keep my status check
        //as a condition at the beginning of the if-block. Ideally, no pressure value should be reported after the stop condition is sent, but one
        //value is always reported for an unknown reason. The problem lies in the embedded code, but is very difficult to find out why it occurs.
        //The approach I use here remedies the problem and does not assign the last pressure measurement to any port basically, because it is reported
        //when the device status is inactive. But what I don't know is whether the last values is ACTUALLY reported AFTER the device is stopped, or
        //right before it is stopped. The difference is miniscule and insignificant, but would be good to find out.
      }


    });

    //########################--- Define API Methods ---######################
    //TODO: I can probably have just 1 characteristic for the pressure, just like I
    //have for the poweroff service. No need for a separate request and value characteristic.
    //For now, however, I will do the Object-orientation using the current approach, and make
    //sure it works, and only then update the characteristic definition and functions.
    flowio.pressure = new Object(); //We must define .pressure as an object in order to assign properties.
    flowio.pressure.port1 = -1;
    flowio.pressure.port2 = -1;
    flowio.pressure.port3 = -1;
    flowio.pressure.port4 = -1;
    flowio.pressure.port5 = -1;

    flowio.pressure.resetChannels = function(){
      flowio.pressure.port1 = -1;
      flowio.pressure.port2 = -1;
      flowio.pressure.port3 = -1;
      flowio.pressure.port4 = -1;
      flowio.pressure.port5 = -1;
    }
    
    flowio.getPressureValue = async function(){
      let pressureDataView = await flowio.pressureService.chrPressureValue.readValue(); //this returns a DataView
      //It is unnecessary to return this value, because this triggers our event listener,
      //and the value is displayed on the screen by the event listener.
      let pressureVal = pressureDataView.getFloat32(0,true); //the 'true' is for the endianness.
      return pressureVal;
    }
    flowio.requestNewReading = async function(){
      let value = new Uint8Array([1]);
      await flowio.pressureService.chrPressureValue.writeValue(value);
    }
    //TODO: Test if the order of the limits matches with the port order on the device.
    flowio.setPressureLimitsMin = async function(p1min,p2min,p3min,p4min,p5min){
      let minLimitsArray = new Float32Array([p1min,p2min,p3min,p4min,p5min]); //creates a view that treats the data in the buffer as float 32-bit
      try{
        await flowio.pressureService.chrMinPressureLimits.writeValue(minLimitsArray);
        flowio.pressure.p1min = p1min;
        flowio.pressure.p2min = p2min;
        flowio.pressure.p3min = p3min;
        flowio.pressure.p4min = p4min;
        flowio.pressure.p5min = p5min;
      }
      catch(error){flowio.log("FlowIO cannot set pressure limits Min. " + error);}
    }
    flowio.setPressureLimitsMax = async function(p1max,p2max,p3max,p4max,p5max){
      let maxLimitsArray = new Float32Array([p1max,p2max,p3max,p4max,p5max]); //creates a view that treats the data in the buffer as float 32-bit
      try{
        await flowio.pressureService.chrMaxPressureLimits.writeValue(maxLimitsArray);
        flowio.pressure.p1max = p1max;
        flowio.pressure.p2max = p2max;
        flowio.pressure.p3max = p3max;
        flowio.pressure.p4max = p4max;
        flowio.pressure.p5max = p5max;
      }
      catch(error){flowio.log("FlowIO cannot set pressure limits Max. " + error);}
    }
    flowio.getPressureLimitsMin = async function(){
      try{
        let val = await flowio.pressureService.chrMinPressureLimits.readValue(); //returns a dataView
        flowio.log("p5Min = " + (flowio.pressure.p5min = val.getFloat32(0, true).toFixed(2)));
        flowio.log("p4Min = " + (flowio.pressure.p4min = val.getFloat32(4, true).toFixed(2))); //offset by 4
        flowio.log("p3Min = " + (flowio.pressure.p3min = val.getFloat32(8, true).toFixed(2))); //offset by 8
        flowio.log("p2Min = " + (flowio.pressure.p2min = val.getFloat32(12,true).toFixed(2))); //offset by 12
        flowio.log("p1Min = " + (flowio.pressure.p1min = val.getFloat32(16,true).toFixed(2))); //offset by 16
      }
      catch(error){
        flowio.log("FlowIO cannot getPressureLimitsMin() " + error);
      }
    }
    flowio.getPressureLimitsMax = async function(){
      try{
        let val = await flowio.pressureService.chrMaxPressureLimits.readValue(); //returns a dataView
        flowio.log("p5Max = " + (flowio.pressure.p5max = val.getFloat32(0, true).toFixed(2)));
        flowio.log("p4Max = " + (flowio.pressure.p4max = val.getFloat32(4, true).toFixed(2)));
        flowio.log("p3Max = " + (flowio.pressure.p3max = val.getFloat32(8, true).toFixed(2)));
        flowio.log("p2Max = " + (flowio.pressure.p2max = val.getFloat32(12,true).toFixed(2)));
        flowio.log("p1Max = " + (flowio.pressure.p1max = val.getFloat32(16,true).toFixed(2)));
      }
      catch(error){
        flowio.log("FlowIO cannot getPressureLimitsMax() " + error);
      }
    }

    //########################################################################

    flowio.getPressureValue();
  }
  catch(error){
    flowio.log("FlowIO failed to initPressureService(). " + error);
  }
}

//##############################---Slider Value Display---#########################
//These functions are executed whenver we move the slider. They are purely GUI functions only. Moreover, none of the instance
//methods depend on any of these functions.

//TODO: Even though there is no interdependency with FlowIO, we may have to pass the flowio object into the argument, so that
//we can set the last character of the ID to the appropriate instance number.
function p1MinSlider(){document.getElementById(`p1min_label`).innerHTML = document.getElementById(`p1min_slider`).value;}
function p2MinSlider(){document.getElementById(`p2min_label`).innerHTML = document.getElementById(`p2min_slider`).value;}
function p3MinSlider(){document.getElementById(`p3min_label`).innerHTML = document.getElementById(`p3min_slider`).value;}
function p4MinSlider(){document.getElementById(`p4min_label`).innerHTML = document.getElementById(`p4min_slider`).value;}
function p5MinSlider(){document.getElementById(`p5min_label`).innerHTML = document.getElementById(`p5min_slider`).value;}

function p1MaxSlider(){document.getElementById(`p1max_label`).innerHTML = document.getElementById(`p1max_slider`).value;}
function p2MaxSlider(){document.getElementById(`p2max_label`).innerHTML = document.getElementById(`p2max_slider`).value;}
function p3MaxSlider(){document.getElementById(`p3max_label`).innerHTML = document.getElementById(`p3max_slider`).value;}
function p4MaxSlider(){document.getElementById(`p4max_label`).innerHTML = document.getElementById(`p4max_slider`).value;}
function p5MaxSlider(){document.getElementById(`p5max_label`).innerHTML = document.getElementById(`p5max_slider`).value;}
//#################################################################################

//This function simply takes the pressure limits set in the UI and passes them to the 2 setter methods.
async function setPressureLimits(flowio){
  if (flowio.bleDevice && flowio.bleDevice.gatt.connected) {
    let p1min = document.getElementById(`p1min_slider`).value;
    let p2min = document.getElementById(`p2min_slider`).value;
    let p3min = document.getElementById(`p3min_slider`).value;
    let p4min = document.getElementById(`p4min_slider`).value;
    let p5min = document.getElementById(`p5min_slider`).value;

    let p1max = document.getElementById(`p1max_slider`).value;
    let p2max = document.getElementById(`p2max_slider`).value;
    let p3max = document.getElementById(`p3max_slider`).value;
    let p4max = document.getElementById(`p4max_slider`).value;
    let p5max = document.getElementById(`p5max_slider`).value;

    await flowio.setPressureLimitsMin(p1min,p2min,p3min,p4min,p5min);
    await flowio.setPressureLimitsMax(p1max,p2max,p3max,p4max,p5max);

    flowio.log("Limits Set");
  }
  else flowio.log("Device not connected");
}
