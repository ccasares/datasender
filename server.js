'use strict';

// Module imports
var express = require('express')
  , restify = require('restify')
  , http = require('http')
  , bodyParser = require('body-parser')
  , util = require('util')
  , queue = require('block-queue')
  , _ = require('lodash')
;

//var DBHOST   = "https://129.152.129.94";
var DBHOST   = "https://SOADB";
var SERVICE  = "/apex/pdb1/anki/event";
var LAP      = "/lap/:demozone";
var SPEED    = "/speed/:demozone";
var OFFTRACK = "/offtrack/:demozone";

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
  , server = http.createServer(app)
  , dbClient = restify.createStringClient({
    url: DBHOST,
    rejectUnauthorized: false
  })
;

// Initializing QUEUE variables BEGIN
var q = undefined;
var queueConcurrency = 1;
// Initializing QUEUE variables END

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  console.log("Uncaught Exception: " + err);
  console.log("Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  console.log("Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

// REST engine initial setup
var PORT = 9998;
var restURI = '/event';
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// REST stuff - BEGIN
router.post(LAP, function(req, res) {

  var data = {
    deviceid: 'mydeviceid',
    datetime: '19-JAN-16 12.01.02',
    datetimestring: 'hola mundo',
    racestatus: 'RACING',
    raceid: '21',
    carid: 'EEE',
    carname: 'Ground Shock',
    lap: '2',
    laptime: 333
  };

  q.push({
    service: LAP.replace(':demozone', req.params.demozone),
    data: data
  });

  res.send("OK");
});

router.post(SPEED, function(req, res) {
  q.push({
    service: SPEED.replace(':demozone', req.params.demozone),
    data: req.body
  });
  res.send("OK");
});

router.post(OFFTRACK, function(req, res) {
  q.push({
    service: OFFTRACK.replace(':demozone', req.params.demozone),
    data: req.body
  });
  res.send("OK");
});

app.use(restURI, router);
// REST stuff - END

// Start QUEUE
q = queue(queueConcurrency, function(task, done) {
  insert(DBHOST + SERVICE + task.service, task.data);
  done(); // Let queue handle next task
});

server.listen(PORT, function() {
  _.each(router.stack, function(r) {
    // We take just the first element in router.stack.route.methods[] as we assume one HTTP VERB at most per URI
    console.log("'" + _.keys(r.route.methods)[0].toUpperCase() + "' method available at https://localhost:" + PORT + restURI + r.route.path);
  });
});

function insert(URI, data) {
  dbClient.post(URI, data, function(err, req, res, data) {
    if (err) {
      var start = '<span class="reason">';
      var end = '</span>';
      var s1 = err.message.substring(err.message.indexOf(start) + start.length);
      var s2 = s1.substring(0,s1.indexOf(end)).replace('\n', ' ');
      console.log("ERROR: %s", s2);
    } else {
      console.log("OK: %d" + res.statusCode);
    }
  });
}
