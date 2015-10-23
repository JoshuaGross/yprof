/**
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var exec = require('child_process').exec;
var path = require('path');
var assert = require('assert');
function execute(command, callback){
  exec(command, function(error, stdout, stderr) {
    callback(stdout);
  });
};

var profiler = path.join(__dirname, '../yprof.js');

describe('sync profiles', function () {
  it('should produce flat call stack', function (done) {
    this.timeout(5000);

    execute(profiler + ' --format=gprof-flat test/examples/sync.js', function (output) {
      /* (5 lines of preamble)
      49.29            2.9      2.9      1     2900        0  /test/examples/sync.js
      17.12            3.9        1   2000      0.5        0  b
      16.74            4.9     0.98   1000     0.98        0  a2
      16.74            5.9     0.98   1000     0.98        0  a
      0.1097           5.9   0.0064   2000   0.0032        0  c
      (3 auxiliary lines)
      */
      var lines = output.split("\n").map(function (line) {
        return line.replace(/^\s*(.*?)\s*$/, '$1').split(/\s+/);
      });
      assert.equal(lines.length, 12);
      lines = lines.slice(5, lines.length - 2);

      assert.ok(lines[0][0].match(/^(3[6-9]|4[0-9]|5[0-5])(\.[0-9]+)?$/)); // high 30s / 40s / low 50s
      assert.ok(lines[1][0].match(/^(1[6-9]|2[0-5])(\.[0-9]+)?$/)); // low 20s / high teens
      assert.ok(lines[2][0].match(/^(1[6-9]|2[0-5])(\.[0-9]+)?$/)); // low 20s / high teens
      assert.ok(lines[3][0].match(/^(1[6-9]|2[0-5])(\.[0-9]+)?$/)); // low 20s / high teens
      assert.ok(lines[4][0].match(/^[0-9](\.[0-9]+)?$/)); // <= 10

      var sum = 0 + parseFloat(lines[0][0]) + parseFloat(lines[1][0]) +
        parseFloat(lines[2][0]) + parseFloat(lines[3][0]) + parseFloat(lines[4][0]);
      assert.ok(sum >= 99 && sum <= 110); // TODO: fix: % should add up to 100%

      done();
    });
  });

  it('should produce call graph', function (done) {
    this.timeout(5000);

    execute(profiler + ' --format=gprof-callgraph test/examples/sync.js', function (output) {
      /* (5 lines of preamble)
       index   % time   self    children  called     name
        [1]     202%     2853    2931      1          Object.<anonymous> (/test/examples/sync.js:1:166) [1]
                         967.1   497.3     1000/2000      a (/test/examples/sync.js:1:248)
                         969.2   497.5     1000/2000      a2 (/test/examples/sync.js:5:42)
        -----------------------------------------------
                         969.2   497.5     1000/1000      Object.<anonymous> (/test/examples/sync.js:1:166)
        [2]     51.22%   969.2   497.5     1000       a2 (/test/examples/sync.js:5:42) [2]
                         494.3   3.167     1000/1000      b (/test/examples/sync.js:9:41)
        -----------------------------------------------
                         967.1   497.3     1000/1000      Object.<anonymous> (/test/examples/sync.js:1:166)
        [3]     51.14%   967.1   497.3     1000       a (/test/examples/sync.js:1:248) [3]
                         494.1   3.147     1000/1000      b (/test/examples/sync.js:9:41)
        -----------------------------------------------
                         988.4   6.315     1000/2000      a (/test/examples/sync.js:1:248)
                         988.4   6.315     1000/2000      a2 (/test/examples/sync.js:5:42)
        [4]     34.74%   988.4   6.315     2000       b (/test/examples/sync.js:9:41) [4]
                         6.315   0         2000/2000      c (/test/examples/sync.js:13:43)
        -----------------------------------------------
                         6.315   0         2000/2000      b (/test/examples/sync.js:9:41)
        [5]     0.2205%  6.315   0         2000       c (/test/examples/sync.js:13:43) [5]
        (3 auxiliary lines)
       */

      var lines = output.split("\n")
      assert.equal(lines.length, 26);
      var frames = lines.slice(5, lines.length - 2).join("\n").split("-----------------------------------------------");

      frames = frames.map(function (frame) {
        return frame.replace(/^\s*(.*?)\s*$/, "$1").split("\n").filter(function (line) {
          return line !== '';
        });
      });

      assert.equal(frames.length, 5);

      var index_1_2_a = frames[1][1].indexOf('a (/test/examples/sync.js:1:14) [2]');
      var index_1_2_a2 = frames[1][1].indexOf('a2 (/test/examples/sync.js:5:15) [2]');
      var index_2_2_a = frames[2][1].indexOf('a (/test/examples/sync.js:1:14) [3]');
      var index_2_2_a2 = frames[2][1].indexOf('a2 (/test/examples/sync.js:5:15) [3]');
      var index_3_3_b = frames[3][2].indexOf('b (/test/examples/sync.js:9:14) [4]');

      // make sure that functions are in the right place
      assert.ok(frames[0][0].indexOf('[1]') === 0);
      assert.ok(frames[1][1].indexOf('[2]') === 0);
      assert.ok(index_1_2_a !== -1 || index_1_2_a2 !== -1);
      assert.ok(frames[2][1].indexOf('[3]') === 0);
      assert.ok(index_2_2_a !== -1 || index_2_2_a2 !== -1);
      assert.ok(frames[3][2].indexOf('[4]') === 0);
      assert.ok(index_3_3_b !== -1);
      assert.ok(frames[4][1].indexOf('[5]') === 0);

      // make sure that time % numbers look okay
      assert.ok(frames[0][0].match(/\]\s*(100|9[0-9]|8[6-9])(\.[0-9]+)?\%/)); // ~100%
      assert.ok(frames[1][1].match(/\]\s*(3[0-9]|4[0-5])(\.[0-9]+)?\%/)); // 30-45
      assert.ok(frames[2][1].match(/\]\s*(3[0-9]|4[0-5])(\.[0-9]+)?\%/)); // 30-45
      assert.ok(frames[3][2].match(/\]\s*(3[0-9]|4[0-9])(\.[0-9]+)?\%/)); // 30-50
      assert.ok(frames[4][1].match(/\]\s*([0-9]|1[0-9]|2[0-5])\.[0-9]+\%/)); // ~10-20

      // make sure that call counts are exactly accurate
      assert.equal(frames[0][0].split(/\s+/)[4], "1");
      assert.equal(frames[0][1].split(/\s+/)[3], "1000/2000");
      assert.equal(frames[0][2].split(/\s+/)[3], "1000/2000");
      assert.equal(frames[1][0].split(/\s+/)[3], "1000/1000");
      assert.equal(frames[1][1].split(/\s+/)[4], "1000");
      assert.equal(frames[1][2].split(/\s+/)[3], "1000/1000");
      assert.equal(frames[2][0].split(/\s+/)[3], "1000/1000");
      assert.equal(frames[2][1].split(/\s+/)[4], "1000");
      assert.equal(frames[2][2].split(/\s+/)[3], "1000/1000");
      assert.equal(frames[3][0].split(/\s+/)[3], "1000/2000");
      assert.equal(frames[3][1].split(/\s+/)[3], "1000/2000");
      assert.equal(frames[3][2].split(/\s+/)[4], "2000");
      assert.equal(frames[3][3].split(/\s+/)[3], "2000/2000");
      assert.equal(frames[4][0].split(/\s+/)[3], "2000/2000");
      assert.equal(frames[4][1].split(/\s+/)[4], "2000");

      done();
    });
  });

  it('should handle try/catch', function (done) {
    this.timeout(5000);

    execute(profiler + ' --format=raw-callgraph --collapse-module-load-frames test/examples/sync-try1.js', function (output) {
      var callgraph = JSON.parse(output);

      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-try1.js:1:0)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-try1.js:1:0)"].subcalls["a (/test/examples/sync-try1.js:1:14)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-try1.js:1:0)"].subcalls["a (/test/examples/sync-try1.js:1:14)"].subcalls["b (/test/examples/sync-try1.js:9:14)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-try1.js:1:0)"].subcalls["a (/test/examples/sync-try1.js:1:14)"].subcalls["c (/test/examples/sync-try1.js:13:14)"].calls, 1);

      done();
    });
  });

  it('should handle new object creation', function (done) {
    this.timeout(5000);

    execute(profiler + ' --format=raw-callgraph --collapse-module-load-frames test/examples/sync-new.js', function (output) {
      var callgraph = JSON.parse(output);

      // Maybe helpful for <A> to be labeled as <new A> at some point in the future
      // The sourceDict has no idea how a function is being invoked but the callstack does.
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-new.js:1:0)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-new.js:1:0)"].subcalls["A (/test/examples/sync-new.js:1:14)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-new.js:1:0)"].subcalls["A (/test/examples/sync-new.js:1:14)"].subcalls["b (/test/examples/sync-new.js:4:14)"].calls, 1);
      assert.equal(callgraph.subcalls["Object.<anonymous> (/test/examples/sync-new.js:1:0)"].subcalls["A (/test/examples/sync-new.js:1:14)"].subcalls["b (/test/examples/sync-new.js:4:14)"].subcalls["c (/test/examples/sync-new.js:7:14)"].calls, 1);

      done();
    });
  });

  it('should handle property setting/getting and ++/-- operations', function (done) {
    this.timeout(5000);

    execute(profiler + ' --format=gprof-flat --collapse-module-load-frames test/examples/sync-operators.js', function (output) {
      // This tests getters/setters as well as verifying that a bug related to ++/-- instrumentation has been fixed

      var lines = output.split("\n").map(function (line) {
        return line.replace(/^\s*(.*?)\s*$/, '$1').split(/\s+/);
      });
      assert.equal(lines.length, 13);
      lines = lines.slice(5, lines.length - 2);

      // calls and frame names
      var lineExists = function (frameName, calls) {
        assert.ok(lines.reduce(function (prev, curr) {
          return prev || (curr[6] == frameName && parseInt(curr[3]) == calls);
        }));
      };

      lineExists('Object.<anonymous>', 1);
      lineExists('assert', 16);
      lineExists('setter:counter', 6);
      lineExists('getter:lameCounter', 4);
      lineExists('getter:counter', 6);
      lineExists('F', 1);

      done();
    });
  });
});
