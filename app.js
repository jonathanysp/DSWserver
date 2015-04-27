var express = require('express');
var app = express();
var logger = require('morgan');
var bodyParser = require("body-parser");
var server = require('http').Server(app);
var io = require('socket.io')(server);
var repl = require('repl');
var replServer = repl.start({prompt: "drone>"});
var arDrone = require('ar-drone');
var geolib = require('geolib');

/******* Constants ***************/
var HTTP_PORT = (process.env.PORT || 3000);
var UDP_PORT = 4000;

/*********************************/
// Status codes
var INVALID_REQUEST = -2;
var NO_DRONES = -1;
var SUCCESS = 0;

/*********************************/
/*
phone = {
	id: string,
	lat: float,
	lon: float,
}

drone = {
	id: string,
	lat: float,
	lon: float,
	client: arDroneClient,
	heading: number,
	north: number
}

*/
var phone = {};
var drone = {};
var go = false;

/*********************************/

app.use(logger('dev'));
app.use(bodyParser.json());

/*********************************/

var router = express.Router();

router.get('/', function(req, res) {
	res.send('hello world');
});

router.get('/dash', function(req, res) {
	res.sendFile(__dirname + '/public/dash.html');
})

app.use('/', router);

/***********************************/

var mobileRoute = express.Router();

mobileRoute.get('/', function(req, res) {
	res.send('mobile!');
});

/*
 * POST => /mobile/data
 * {
 * 		id: String,
 * 		lat: Number,
 * 		lon: Number,
 * }
 *
 * <= 200
 */
mobileRoute.post('/data', function(req, res) {
	console.log(req.body);
	io.emit('log', {target: "/data", body: req.body});
	phone.lat = req.body.lat;
	phone.lon = req.body.lon;
	res.json({});
});

/*
 * POST => /mobile/request
 * {
 * 		id: String,
 * }
 */
mobileRoute.post('/request', function(req, res) {
	console.log(req.body);
	io.emit('log', {target: "/request", body: req.body});

	if (phone !== null) {
		phone = req.body.id;
		res.json({
			status: SUCCESS
		});
	} else {
		res.json({
			status: NO_DRONES
		})
	}


});

/*
 * POST => /mobile/unpair
 * {
 * 		id: String,
 * }
 */
mobileRoute.post('/unpair', function(req, res) {
	console.log(req.body);
	io.emit('log', {target: "/unpair", body: req.body});

	if (phone === req.body.id) {
		phone === null;
		//land drone
		res.json({
			status: SUCCESS
		});
	} else {
		res.json({
			status: INVALID_REQUEST
		})
	}
});

/*
 * POST => /mobile/cmd
 * {
 * 		id: String,
 * 		cmd: Number,
 * }
 */
mobileRoute.post('/cmd', function(req, res) {
	console.log(req.body);
	io.emit('log', {target: "/cmd", body: req.body});
	res.json({});
});

app.use('/mobile', mobileRoute);

server.listen(HTTP_PORT);
//app.listen(HTTP_PORT);
console.log("HTTP on port: " + HTTP_PORT);

/************************************/

// var dgram = require('dgram');
// var server = dgram.createSocket('udp4');

// server.on('message', function(message) {
// 	try {
// 		var json = JSON.parse(message.toString());
// 		phone.lat = json.lat;
// 		phone.lon = json.lon;
// 		// console.log(json);
// 		io.emit('log', {target: "UDP", body: json});
// 	} catch (e) {
// 		console.log(e);
// 	}
// });

// server.bind(UDP_PORT);
// console.log("UDP on port: " + UDP_PORT)

var net = require('net');

net.createServer(function(socket) {
	socket.on('data', function(data){
		console.log(data.toString());
		try {
			var json = JSON.parse(data.toString());
			phone.lat = json.lat;
			phone.lon = json.lon;
			phone.loc = {latitude: json.lat, longitude: json.lon}
			// console.log(json);
			io.emit('log', {target: "GPS", body: json});
		} catch (e) {
			console.log("bad");
			console.log(e);
		}
	})
}).listen(4000);

/****** Drone NavData ******/


/***** DEBUG REPL CONTROL *****/
function connect() {
	drone.client = arDrone.createClient();
	drone.offset = 0;
	drone.client.config('general:navdata_demo', 'FALSE');
	console.log('drone connected');
	drone.client.on('navdata', function(data) {
		try {
			drone.lat = data.gps.latitude;
			drone.lon = data.gps.longitude;
			drone.loc = {
				latitude: data.gps.latitude,
				longitude: data.gps.longitude
			}
		} catch (e) {

		}

		try {
		drone.heading = 
			offsetHeading(data.magneto.heading.fusionUnwrapped + 180);
		} catch(e) {
			console.log(e);
		}
	});
	console.log('attached navdata listener');
}

function turn() {
	if (drone) {
		drone.client
		.after(0, function() {
			drone.client.clockwise(0.3);
		})
		.after(500, function() {
			drone.client.stop();
		})
		// clockwise(0.1);
		// drone.client.after(100, function() {this.stop()});
	}
}

function setNorth() {
	drone.offset = drone.heading;
}

function curHeading() {
	console.log(drone.heading);
}

function curLoc() {
	console.log(drone.loc);
}

function offsetHeading(heading) {
	raw = heading - drone.offset;
	var ret;
	if (raw < 0) {
		ret = 360 + raw;
	} else {
		ret = raw;
	}
	
	if (ret > 360) {
		// drone.client.stop();
		// drone.client.land();
		// console.log("PANIC: Heading too large: " + ret + "offset: " + drone.offset);
		// console.log("MOD: " + (ret % 360));
		return ret % 360;
	}

	return ret;
}

function turnTo(deg, cb) {
	cb = cb || function(){};
	if (Math.abs(deg - drone.heading) < 5) {
		return;
	}
	drone.client.clockwise(0.5);
	console.log("turning");
	var checkInterval = setInterval(function() {
		if (Math.abs(deg - drone.heading) < 7.5) {
			console.log("STOP!");
			clearInterval(checkInterval);
			drone.client.stop();
			cb();
		} else {
			console.log(Math.abs(deg - drone.heading));
		}
	}, 100)
}

function move2(target, cb) {
	var start = drone.loc;

	var startTargetDist = geolib.getDistance(start, target);
	if (startTargetDist < 2) {
		return;
	}

	drone.client.front(0.1);
	console.log("moving forward");

	var checkInterval = setInterval(function() {
		targetDroneDist = geolib.getDistance(drone.loc, target);
		startDroneDist = geolib.getDistance(drone.loc, start);
		
		if (startDroneDist < startTargetDist) {
			//keep going
			console.log(targetDroneDist);
			return;
		} else if(targetDroneDist < 2) {
			//arrived
			clearInterval(checkInterval)
			drone.client.stop();
			console.log("Arrived!");
		} else if (startDroneDist > startTargetDist) {
			//Overrun
			clearInterval(checkInterval)
			drone.client.stop();
			console.log("OVERRUN!")
		} else {
			console.log(startDroneDist);
			console.log(startTargetDist);
			console.log(targetDroneDist);
		}
	}, 100);


}

function moveTowards(point, cb) {
	cb = cb || function() {};
	var prevDistance;
	var distance = geolib.getDistance(point, drone.loc);
	if (distance < 2) {
		return;
	}
	drone.client.front(0.1);
	console.log("moving forward");
	var checkInterval = setInterval(function() {
		prevDistance = distance;
		distance = geolib.getDistance(point, drone.loc);
		if (distance < 2) {
			console.log("STOP!");
			clearInterval(checkInterval);
			drone.client.stop();
		} else {
			// if (prevDistance > distance) {
			// 	console.log("OVERUNN!!!");
			// 	clearInterval(checkInterval);
			// 	drone.client.stop();
			// }
			console.log(distance);
		}
	}, 100)
}

function goToPoint(point) {
	if (geolib.getDistance(drone.loc, point) < 3) {
		return;
	}
	var heading = getBearing(drone.loc, point);
	turnToHeading(heading, function() {
		moveTowards(point, function() {
			console.log("DONE!");
		});
	})
	/*
	input: client position, drone position, heading
	1. calculate degree to turn to
	2. turn to point to client
	3. move forward until distance from client is less than sigma
	land
	*/
}

function takeoff() {
	drone.client.takeoff();
}

function land() {
	drone.client.stop();
	drone.client.land();
}

process.on('SIGINT', function() {
	console.log("LAND!!");
	land();
	process.exit();
});

process.on('exit', function() {
	console.log("terminating");
	land();
});

replServer.context.drone = drone;
replServer.context.phone = phone;
replServer.context.connect = connect;
replServer.context.turn = turn;
replServer.context.setNorth = setNorth;
replServer.context.turnTo = turnTo;
replServer.context.goToPoint = goToPoint;
replServer.context.land = land;
replServer.context.takeoff = takeoff;
replServer.context.curHeading = curHeading;
replServer.context.curLoc = curLoc;
replServer.context.curClientLoc = phone
replServer.context.moveTowards = moveTowards;
replServer.context.moveTo = move2;
replServer.context.target = { latitude: 41.8245307,
  longitude: -71.3995923 }




/**************************/

back = {latitude: 41.824469, longitude: -71.392677};
front = {latitude: 41.824480, longitude: -71.392515};
back = new Point(41.824469, -71.392677);
front = new Point(41.824480, -71.392515);
// var target = new Point(41.823333, -71.388889);
// { latitude: 41.8232109, longitude: -71.3890288 }


// replServer.context.target = target;

console.log(geolib.getDistance(back, front));
console.log(getBearing(back, front));

function Point (lat, lon) {
	this.latitude = lat;
	this.longitude = lon;
}

function toGeoLib(point) {
	return {latitude: point.lat, longitude: point.long};
}

function toRadians(degrees) {
	return degrees * Math.PI / 180;
}

function toDegrees(radians) {
	return radians * 180 / Math.PI;
}

function getBearing(from, to) {
    var deltaLon, distance, lat1, lat2, res, x, y;
    distance = geolib.getDistance(from, to);
    if (distance === 0) {
      return 0;
    }
    deltaLon = toRadians(to.longitude - from.longitude);
    lat1 = toRadians(from.latitude);
    lat2 = toRadians(to.latitude);
    y = Math.sin(deltaLon) * Math.cos(lat2);
    x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    res = toDegrees(Math.atan2(y, x));
    return Math.round((res + 360) % 360);
}

replServer.context.getBearing = getBearing;
replServer.context.getDistance = geolib.getDistance;