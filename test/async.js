/**
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var exec = require('child_process').exec;
var path = require('path');
var assert = require('assert');
var spawn = require('child_process').spawn;
function execute(command, callback){
  exec(command, { maxBuffer: Infinity }, function(error, stdout, stderr) {
    callback(stdout);
  });
};

var profiler = path.join(__dirname, '../yprof.js');

describe('async profiles', function () {
  it('should produce flat graph', function (done) {
    this.timeout(10000);

    execute(profiler + ' --format=gprof-flat test/examples/async.js', function (output) {
      /* (5 lines of preamble)
        36.74            1.4      1.4   2000     0.69        0  b (/test/examples/async.js:9:14)
        30.12            2.1     0.76   2000     0.38        0  c (/test/examples/async.js:13:14)
        15.24            2.7     0.57   1000     0.57        0  a (/test/examples/async.js:1:14)
        15.17            3.3     0.57   1000     0.57        0  a2 (/test/examples/async.js:5:15)
        1.73             3.8     0.48      1      480        0  <root> (/test/examples/async.js:1:0)
       (3 lines of whitespace)
       */
      var lines = output.split("\n")
      assert.equal(lines.length, 12);
      lines = lines.slice(5, lines.length - 2);

      assert.ok(lines[0].match(/(c|b)\s*\(.*\)\s*$/));
      assert.ok(lines[1].match(/(b|c)\s*\(.*\)\s*$/));
      assert.ok(lines[2].match(/(a|a2)\s*\(.*\)\s*$/));
      assert.ok(lines[3].match(/(a|a2)\s*\(.*\)\s*$/));
      assert.ok(lines[4].match(/Object.\<anonymous\>\s*\(.*\)\s*$/));

      assert.ok(lines[0].match(/^\s*(3|2[6-9])/));
      assert.ok(lines[1].match(/^\s*(3|2[6-9])/));
      assert.ok(lines[2].match(/^\s*1[0-9]\./));
      assert.ok(lines[3].match(/^\s*1[0-9]\./));
      assert.ok(lines[4].match(/^\s*(1[0-9]|[0-9])\./));

      done();
    });
  });

  it('should produce call graph', function (done) {
    this.timeout(10000);

    execute(profiler + ' --format=gprof-callgraph test/examples/async.js', function (output) {
      var lines = output.split("\n")
      assert.equal(lines.length, 34);
      var frames = lines.slice(5, lines.length - 2).join("\n").split("-----------------------------------------------");

      var frame_3_b = frames[2].indexOf('b (/test/examples/async.js:9:14) [3]');
      var frame_3_a = frames[2].indexOf('a (/test/examples/async.js:1:14) [3]');
      var frame_3_a2 = frames[2].indexOf('a2 (/test/examples/async.js:5:15) [3]');
      var frame_4_b = frames[3].indexOf('b (/test/examples/async.js:9:14) [4]');
      var frame_4_a = frames[3].indexOf('a (/test/examples/async.js:1:14) [4]');
      var frame_4_a2 = frames[3].indexOf('a2 (/test/examples/async.js:5:15) [4]');
      var frame_5_b = frames[4].indexOf('b (/test/examples/async.js:9:14) [5]');
      var frame_5_a = frames[4].indexOf('a (/test/examples/async.js:1:14) [5]');
      var frame_5_a2 = frames[4].indexOf('a2 (/test/examples/async.js:5:15) [5]');

      assert.notEqual(frames[0].indexOf('Object.<anonymous> (/test/examples/async.js:1:0) [1]'), -1);
      assert.notEqual(frames[1].indexOf('Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async> [2]'), -1);
      assert.notEqual((frame_3_a + frame_3_a2 + frame_3_b), -3);
      assert.notEqual((frame_4_a + frame_4_a2 + frame_4_b), -3);
      assert.notEqual((frame_5_a + frame_5_a2 + frame_5_b), -3);
      assert.notEqual(frames[5].indexOf('c (/test/examples/async.js:13:14) [6]'), -1);

      done();
    });
  });

  it('should produce collapsed call graph', function (done) {
    this.timeout(10000);

    execute(profiler + ' --format=gprof-callgraph --collapse-module-load-frames --collapse-frame="Timer.listOnTimeout [as ontimeout] (timers.js:112:15)" test/examples/async.js', function (output) {
      var lines = output.split("\n")
      var frames = lines.slice(5, lines.length - 2).join("\n").split("-----------------------------------------------");

      done();
    });
  });

  it('should produce correct collapsed call graph for fs module', function (done) {
    this.timeout(10000);

    execute(profiler + ' --format=raw-callgraph --collapse-module-load-frames --collapse-frame="Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>" --collapse-frame="Object.oncomplete (fs.js:108:15) <async>" test/examples/async-fs.js 1000', function (output) {
      var outputObject = JSON.parse(output);

      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].fnid, 21);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].calls, 1);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].fnid, 13);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].asyncCalls, 1000);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].fnid, 9);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].asyncCalls, 1000);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].subcalls["setTimeout -> (/test/examples/async-fs.js:7:29)"].fnid, 4);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].subcalls["setTimeout -> (/test/examples/async-fs.js:7:29)"].asyncCalls, 1000);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].subcalls["setTimeout -> (/test/examples/async-fs.js:7:29)"].subcalls["displayStats (/test/examples/async-fs.js:14:30)"].fnid, 16);
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-fs.js:1:0)"].subcalls["a (/test/examples/async-fs.js:4:14)"].subcalls["stat -> (/test/examples/async-fs.js:5:66)"].subcalls["setTimeout -> (/test/examples/async-fs.js:7:29)"].subcalls["displayStats (/test/examples/async-fs.js:14:30)"].asyncCalls, 1000);

      done();
    });
  });

  it('should be able to profile a TCP server', function (done) {
    this.timeout(10000);

    var child = spawn(profiler, ['--format=raw-callgraph', '--collapse-module-load-frames', 'test/examples/async-server.js'], {
      detached: false
    });

    child.stderr.on('data', function (data) {
      console.log('err:', data.toString());
    });

    var output = '';
    child.stdout.on('data', function (data) {
      output += data.toString();
    });

    child.on('close', function () {
      var outputObject = JSON.parse(output);

      // Unfortunately, these callbacks are split across two different frames. This would be really nice to fix in the future.
      assert.equal(outputObject.subcalls["TCP.onconnection (net.js:1192:8)"].subcalls["Server.emit (events.js:95:17)"].subcalls["connectionCallback (/test/examples/async-server.js:5:67)"].calls, 9);

      // This is sometimes not present and is instead Server.connectionCallback instead of connectionCallback.
      // It has something to do with recovering the frame name in instrumentationReceiver.
      assert.equal(outputObject.subcalls["Object.<anonymous> (/test/examples/async-server.js:1:0)"].subcalls["Object.exports.createServer (net.js:76:10)"].subcalls["new Server (net.js:924:10)"].subcalls["TCP.onconnection (net.js:1192:8) <async>"].subcalls["Server.emit (events.js:95:17)"].subcalls["connectionCallback (/test/examples/async-server.js:5:67)"].calls, 1);

      done();
    });

    var net = require('net');
    var openConnections = 0;
    var makeConnection = function () {
      var client = new net.Socket();
      client.connect(1337, '127.0.0.1', function() {
      });

      client.on('data', function(data) {
        //console.log('receive data:', data.toString());
      	client.destroy(); // kill client after server's response
      });

      client.on('close', function() {
        openConnections--;

        if (openConnections === 0) {
          setTimeout(function () {
            child.kill('SIGINT');
          }, 1);
        }
      });
    };

    for (var i = 0; i < 10; i++) {
      openConnections++;
      setTimeout(function () {
        makeConnection();
      }, 1000 + i*100);
    }
  });

});
