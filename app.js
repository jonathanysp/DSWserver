var express = require('express');
var app = express();
var logger = require('morgan');

/******* Constants ***************/
var HTTP_PORT = 3000;
var UDP_PORT = 4000;

/*********************************/

app.use(logger('dev'));

/*********************************/

var router = express.Router();

router.get('/', function(req, res) {
	res.send('hello world');
});

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
	res.send(200);
});

/*
 * POST => /mobile/request
 * {
 * 		id: String,
 * }
 */
mobileRoute.post('/request', function(req, res) {
	console.log(req.body);
	res.send(200);
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
	res.send(200);
});

app.use('/mobile', mobileRoute);

app.listen(HTTP_PORT);
console.log("HTTP on port: " + HTTP_PORT);

/************************************/

var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('message', function(message) {
	console.log("==== Recv UDP Message ====");
	console.log(message.toString());
	try {
		console.log(JSON.parse(message.toString()));
	} catch (e) {
		console.log(e);
	}
});

server.bind(UDP_PORT);
console.log("UDP on port: " + UDP_PORT)
