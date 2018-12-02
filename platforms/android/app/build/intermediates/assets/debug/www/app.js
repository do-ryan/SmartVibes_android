// JavaScript code for the TI SensorTag Demo app.

// load math.js
//import * as math from 'mathjs';

/**
 * Object that holds application data and functions.
 */

var app = {};

app.SIGFIGS = 5;
app.tare = {x:0, y:0, z:0}
/**
 * Variable data that is stored and displayed
 */
app.dataPoints = [];
// data in the plot
app.allData = [];
// all data since start of test
app.allDataTime = [];
// sampling time steps since start of test
app.last_sampled_time = 0;
// raw time fo last sampled datapoint
app.arms = 0; 
// root mean square acceleration
app.peak = 0;
// peak acceleration
app.risk_level = 0;
// overall risk level


/**
 * Timeout (ms) after which a message is shown if the SensorTag wasn't found.
 */
app.CONNECT_TIMEOUT = 3000;

/**
 * Object that holds SensorTag UUIDs.
 */
app.sensortag = {};

// UUIDs for movement services and characteristics.
app.sensortag.MOVEMENT_SERVICE = 'f000aa80-0451-4000-b000-000000000000';
app.sensortag.MOVEMENT_DATA = 'f000aa81-0451-4000-b000-000000000000';
app.sensortag.MOVEMENT_CONFIG = 'f000aa82-0451-4000-b000-000000000000';
app.sensortag.MOVEMENT_PERIOD = 'f000aa83-0451-4000-b000-000000000000'; // can change period here
app.sensortag.MOVEMENT_NOTIFICATION = '00002902-0000-1000-8000-00805f9b34fb';

/**
 * Initialise the application.
 */
app.initialize = function()
{
	document.addEventListener(
		'deviceready',
		function() { evothings.scriptsLoaded(app.onDeviceReady) },
		false);

	// Called when HTML page has been loaded.
	$(document).ready( function()
	{
		// Adjust canvas size when browser resizes
		$(window).resize(app.respondCanvas);

		// Adjust the canvas size when the document has loaded.
		app.respondCanvas();
	});
};

/**
 * Adjust the canvas dimensions based on its container's dimensions.
 */
app.respondCanvas = function()
{
	var canvas = $('#canvas')
	var container = $(canvas).parent()
	canvas.attr('width', $(container).width() ) // Max width
	// Not used: canvas.attr('height', $(container).height() ) // Max height
};

app.onDeviceReady = function()
{
	app.showInfo('Activate the SensorTag and tap Start.');
};

app.showInfo = function(info)
{
	document.getElementById('info').innerHTML = info;
};

app.onStartButton = function()
{
	app.onPauseButton();
	app.startScan();
	app.showInfo('Status: Scanning...');
	app.startConnectTimer();
};

app.onPauseButton = function()
{
	// Stop any ongoing scan and close devices.
	app.stopConnectTimer();
	evothings.easyble.stopScan();
	evothings.easyble.closeConnectedDevices();
	app.showInfo('Status: Stopped.');
};

app.onTareButton = function()
{
// zeros all acceleration values
	app.onStartButton(); // collect one set of datapoints
	app.tare['x'] = app.allData[0]['x'];
	app.tare['y'] = app.allData[0]['y'];
	app.tare['z'] = app.allData[0]['z'];
	app.onStopButton(); // reset
}

app.onStopButton = function()
{
	app.onPauseButton();
	app.dataPoints = [];
	// data in the plot
	app.allData = [];
	// all data since start of test
	app.allDataTime = [];
	// sampling time steps since start of test
	app.last_sampled_time = 0;
	// raw time fo last sampled datapoint
	app.arms = 0; 
	// root mean square acceleration
	app.peak = 0;
	app.risk_level=0;
}

app.startConnectTimer = function()
{
	// If connection is not made within the timeout
	// period, an error message is shown.
	app.connectTimer = setTimeout(
		function()
		{
			app.showInfo('Status: Scanning... ' +
				'Please press the activate button on the tag.');
		},
		app.CONNECT_TIMEOUT)
}

app.stopConnectTimer = function()
{
	clearTimeout(app.connectTimer);
}

app.startScan = function()
{
	evothings.easyble.reportDeviceOnce(true);
	evothings.easyble.startScan(
		function(device)
		{
			// Connect if we have found a sensor tag.
			if (app.deviceIsSensorTag(device))
			{
				app.showInfo('Status: Device found: ' + device.name + '.');
				evothings.easyble.stopScan();
				app.connectToDevice(device);
				app.stopConnectTimer();
			}
		},
		function(errorCode)
		{
			app.showInfo('Error: startScan: ' + errorCode + '.');
		});
};

app.deviceIsSensorTag = function(device)
{
	console.log('device name: ' + device.name);
	return (device != null) &&
		(device.name != null) &&
		(device.name.indexOf('Sensor Tag') > -1 ||
			device.name.indexOf('SensorTag') > -1);
};

/**
 * Read services for a device.
 */
app.connectToDevice = function(device)
{
	app.showInfo('Connecting...');
	device.connect(
		function(device)
		{
			app.showInfo('Status: Connected - reading SensorTag services...');
			app.readServices(device);
		},
		function(errorCode)
		{
			app.showInfo('Connection error: ' + errorCode);
		});
};

app.readServices = function(device)
{
	device.readServices(
		[
		app.sensortag.MOVEMENT_SERVICE // Movement service UUID.
		],
		// Function that monitors accelerometer data.
		app.startAccelerometerNotification,
		function(errorCode)
		{
			console.log('Error: Failed to read services: ' + errorCode + '.');
		});
};

/**
 * Read accelerometer data.
 */
app.startAccelerometerNotification = function(device)
{
	app.showInfo('Status: Starting accelerometer notification...');

	// Set accelerometer configuration to ON.
	// magnetometer on: 64 (1000000) (seems to not work in ST2 FW 0.89)
	// 3-axis acc. on: 56 (0111000)
	// 3-axis gyro on: 7 (0000111)
	// 3-axis acc. + 3-axis gyro on: 63 (0111111)
	// 3-axis acc. + 3-axis gyro + magnetometer on: 127 (1111111)
	device.writeCharacteristic(
		app.sensortag.MOVEMENT_CONFIG,
		new Uint8Array([56,0]),
		function()
		{
			console.log('Status: writeCharacteristic ok.');
		},
		function(errorCode)
		{
			console.log('Error: writeCharacteristic: ' + errorCode + '.');
		});

	// Set accelerometer period to 100 ms.
	device.writeCharacteristic(
		app.sensortag.MOVEMENT_PERIOD,
		new Uint8Array([10]),
		function()
		{
			console.log('Status: writeCharacteristic ok.');
		},
		function(errorCode)
		{
			console.log('Error: writeCharacteristic: ' + errorCode + '.');
		});

	// Set accelerometer notification to ON.
	device.writeDescriptor(
		app.sensortag.MOVEMENT_DATA,
		app.sensortag.MOVEMENT_NOTIFICATION, // Notification descriptor.
		new Uint8Array([1,0]),
		function()
		{
			console.log('Status: writeDescriptor ok.');
		},
		function(errorCode)
		{
			// This error will happen on iOS, since this descriptor is not
			// listed when requesting descriptors. On iOS you are not allowed
			// to use the configuration descriptor explicitly. It should be
			// safe to ignore this error.
			console.log('Error: writeDescriptor: ' + errorCode + '.');
		});

	// Start accelerometer notification.
	device.enableNotification(
		app.sensortag.MOVEMENT_DATA,
		function(data)
		{
			var CONV_TO_MS2 = 9.80665*4;

			app.showInfo('Status: Data stream active - accelerometer');
			var dataArray = new Uint8Array(data);
			var values = app.getAccelerometerValues(dataArray);
			var d = new Date();

			values['x'] = values['x'] - app.tare['x'];
			values['y'] = values['y'] - app.tare['y'];
			values['z'] = values['z'] - app.tare['z'];
			// subtract tare values

			document.getElementById('zacc').innerHTML = "Z acc: " + (values['z']*CONV_TO_MS2).toPrecision(app.SIGFIGS);
			// update z acc label (m/s^2)

			app.updatePeak(values);
			// update waveform peak (max acc in raw units bewteen all axes)

			app.allDataTime.push(d.getTime() - app.last_sampled_time);
			document.getElementById('period').innerHTML = "Sampling period (ms): " + (d.getTime() - app.last_sampled_time); // update sampling period in ms(need to increase this)
			app.last_sampled_time = d.getTime();
			// update last sampled time

			app.allData.push(values);
			//add to all data array

			// calculate root means square acceleration
			document.getElementById('arms').innerHTML = app.rmsAccel().toPrecision(app.SIGFIGS);
			document.getElementById('vdv').innerHTML = app.vdv().toPrecision(app.SIGFIGS); // calculate vdv
			document.getElementById('cf').innerHTML = (app.peak*CONV_TO_MS2/document.getElementById('arms').innerHTML).toPrecision(app.SIGFIGS); // crest factor
			//update metrics
			document.getElementById('risk').innerHTML = app.riskLevel(document.getElementById('arms').innerHTML, document.getElementById('vdv').innerHTML, document.getElementById('cf').innerHTML).toPrecision(app.SIGFIGS);
			app.drawDiagram(values);
		},
		function(errorCode)
		{
			console.log('Error: enableNotification: ' + errorCode + '.');
		});
};

/**app.rmsAccel = function(values)
// average accel
{
	var CONV_TO_MS2 = 9.80665*4 // this needs to be properly determined
	//var CONV_TO_MS2 = 1;
	var cum_arms = 0;
	for (var i = 0; i < app.allData.length; i++){
		cum_arms = cum_arms + (app.allData[i]['z']* CONV_TO_MS2); // just takes z for now
	}
.
	cum_arms = cum_arms  / (app.allData.length);

	document.getElementById('arms').innerHTML = cum_arms;
}**/

app.riskLevel = function(arms, vdv, cf)
// takes in root mean square acceleration, vibration dose value, and crest factor, then computes a weighted average
{
	arms_weight=1.5E3;
	vdv_weight=2E-2;
	cf_weight=5E-5;
	return (arms*arms_weight+vdv*vdv_weight+cf*cf_weight)/3;
}

app.updatePeak = function(values)
// returns new peak in raw unit form
// takes in acceleration values of current sample
{
	if (values['x']>app.peak){
		app.peak= values['x'];
	}
	if(values['y']>app.peak){
		app.peak = values['y'];
	}
	if(values['z']>app.peak){
		app.peak = values['z'];
	}
}

app.rmsAccel = function()
// arms = sqrt(1/T * integral_0_to_T (a_z^2*dt))
{	
	var MS_TO_SECOND = 1/1000;
	var CONV_TO_MS2 = 9.80665*4;
	var a_x2 = [];
	var a_y2 = [];
	var a_z2 = [];

	var T = app.allDataTime.reduce(getSum)*MS_TO_SECOND;
	// get total time length in seconds

	for (var i = 0; i < app.allData.length; i++)
	{
		a_x2.push(Math.pow((app.allData[i]['x']*CONV_TO_MS2),2));
		a_y2.push(Math.pow((app.allData[i]['y']*CONV_TO_MS2),2));
		a_z2.push(Math.pow((app.allData[i]['z']*CONV_TO_MS2),2));
	}

	var rms_accel = Math.sqrt((1/T)*(app.integrate(a_x2, app.allDataTime)+app.integrate(a_y2, app.allDataTime)+app.integrate(a_z2, app.allDataTime)));

	function getSum(total, num) 
	{
    	return total + num;
	}

	return rms_accel;
}	

app.vdv = function()
{
	var MS_TO_SECOND;
	var CONV_TO_MS2 = 9.80665*4;
	var a_x4 = [];
	var a_y4 = [];
	var a_z4 = [];

	for (var i = 0; i < app.allData.length; i++)
	{
		a_x4.push(Math.pow((app.allData[i]['x']*CONV_TO_MS2),4));
		a_y4.push(Math.pow((app.allData[i]['y']*CONV_TO_MS2),4));
		a_z4.push(Math.pow((app.allData[i]['z']*CONV_TO_MS2),4));
	}

	var vdv = Math.pow(app.integrate(a_x4, app.allDataTime)+app.integrate(a_y4, app.allDataTime)+app.integrate(a_z4, app.allDataTime),1/4);
	return vdv;
}

app.integrate = function(integrand, time)
	//uses trapezoid rule to compute integral wrt time vector
{
	var integral = 0;
	var timestep = 0;
	var MS_TO_SECOND = 1/1000

	for (var i = 0; i < integrand.length-1; i++){
		timestep = time[i+1]*MS_TO_SECOND;
		integral = integral + timestep*(integrand[i]+integrand[i+1])/2;
	}

	return integral;
}

/**
 * Calculate accelerometer values from raw data for SensorTag 2.
 * @param data - an Uint8Array.
 * @return Object with fields: x, y, z.
 */

app.getAccelerometerValues = function(data)
{
	var divisors = { x: -16384.0, y: 16384.0, z: -16384.0 };

	// Calculate accelerometer values.
	var ax = evothings.util.littleEndianToInt16(data, 6)/ divisors.x;
	var ay = evothings.util.littleEndianToInt16(data, 8)/ divisors.y;
	var az = evothings.util.littleEndianToInt16(data, 10)/ divisors.z; // subtract gravity

	// Return result.
	return { x: ax, y: ay, z: az };
};

/**
 * Plot diagram of sensor values.
 * Values plotted are expected to be between -1 and 1
 * and in the form of objects with fields x, y, z.
 */
app.drawDiagram = function(values)
{
	var canvas = document.getElementById('canvas');
	var context = canvas.getContext('2d');

	// Add recent values.
	app.dataPoints.push(values);

	// Remove data points that do not fit the canvas.
	if (app.dataPoints.length > canvas.width)
	{
		app.dataPoints.splice(0, (app.dataPoints.length - canvas.width));
	}

	// Value is an accelerometer reading between -1 and 1.
	function calcDiagramY(value)
	{
		// Return Y coordinate for this value.
		var diagramY =
			((value * canvas.height) / 2)
			+ (canvas.height / 2);
		return diagramY;
	}

	function drawLine(axis, color)
	{
		context.strokeStyle = color;
		context.beginPath();
		var lastDiagramY = calcDiagramY(
			app.dataPoints[app.dataPoints.length-1][axis]);
		context.moveTo(0, lastDiagramY);
		var x = 1;
		for (var i = app.dataPoints.length - 2; i >= 0; i--)
		{
			var y = calcDiagramY(app.dataPoints[i][axis]);
			context.lineTo(x, y);
			x++;
		}
		context.stroke();
	}

	// Clear background.
	context.clearRect(0, 0, canvas.width, canvas.height);

	// Draw lines.
	drawLine('x', '#005A9C');
	drawLine('y', '#ff6347');
	drawLine('z', '#E6A817');
};

// Initialize the app.
app.initialize();