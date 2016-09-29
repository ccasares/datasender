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
const DBHOST   = "https://ANKIDB";
const SERVICE  = "/apex/pdb1/anki/event";
const LAP      = "/lap/:demozone";
const SPEED    = "/speed/:demozone";
const OFFTRACK = "/offtrack/:demozone";

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
const PORT = 9998;
const restURI = '/event';
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// REST stuff - BEGIN
router.post(LAP, function(req, res) {

  var input = req.body;
  var data = {
    deviceid: input.deviceId,
    datetime: new Date(input.dateTime * 1000).toUTCString(),
    datetimestring: input.dateTimeString,
    racestatus: input.raceStatus,
    raceid: input.raceId,
    carid: input.carId,
    carname: input.carName,
    lap: input.lap,
    laptime: input.lapTime
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
  console.log("Queueing call to %s with data: %j", DBHOST + SERVICE + task.service, task.data);
  insert(DBHOST + SERVICE + task.service, task.data);
  done(); // Let queue handle next task
});

server.listen(PORT, () => {
  _.each(router.stack, (r) => {
    // We take just the first element in router.stack.route.methods[] as we assume one HTTP VERB at most per URI
    console.log("'" + _.keys(r.route.methods)[0].toUpperCase() + "' method available at https://localhost:" + PORT + restURI + r.route.path);
  });
});

function insert(URI, data) {
  dbClient.post(URI, data, (err, req, res, data) => {
    console.log("done");
    if (err) {
      // Error comes as a HTML page.I try to remove all HTML garbage and keep just the error message
      // Tried to use a regexp expression but didn't succeed :-(
      var start = '<span class="reason">';
      var end = '</span>';
      var s1 = err.message.substring(err.message.indexOf(start) + start.length);
      var s2 = s1.substring(0,s1.indexOf(end)).replace('\n', ' '); // Get rid of any newline in the error message
      console.log("ERROR: %s", s2);
    } else {
      console.log("OK: %d" + res.statusCode);
    }
  });
}
