/**
 * We don't need to test all formatters here, only the ones not covered by other tests.
 *
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

describe('formatter tests', function () {
  it('should produce yprof-sync-bottlenecks format', function (done) {
    execute(profiler + ' --format=yprof-sync-bottlenecks test/examples/format-sync-offenders.js', function (output) {
      var lines = output.split("\n").map(function (line) {
        return line.replace(/^\s*(.*?)\s*$/, '$1');
      });
      assert.equal(lines.length, 8);
      lines = lines.slice(2, lines.length - 2);

      assert.ok(lines[0].indexOf('<anonymous>') === 0);
      assert.ok(lines[1].indexOf('Object.<anonymous>') === 0);

      done();
    });
  });
});
