var express = require('express');
var app = express();
var logger = require('morgan');
var bodyParser = require("body-parser");
var server = require('http').Server(app);
var io = require('socket.io')(server);

/******* Constants ***************/
var HTTP_PORT = (process.env.PORT || 3000);
var UDP_PORT = 4000;

/*********************************/

app.use(logger('dev'));
//app.use(bodyParser.urlencoded({extended: false}));
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
	res.sendStatus(200);
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
	res.sendStatus(200);
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
	res.sendStatus(200);
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
	res.sendStatus(200);
});

app.use('/mobile', mobileRoute);

server.listen(HTTP_PORT);
//app.listen(HTTP_PORT);
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
