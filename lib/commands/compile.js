/**
 * yprof compiler.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = {
  description: 'Compile (run the "instrument" step) on all matched files and put them into a given cache directory. If you run yprof against the same cache directory and turn on --cache-only, you can guarantee that yprof is only running code already on the disk.',
  setupOptions: function (commander) {
    commander
      .option('-p, --pattern <pattern>', 'File pattern to compile, defaults to **/*.js', '**/*.js')
      .option('-c, --cache-dir <cacheDir>', 'Required. Cache directory to save transpiled sources to')
      .option('-g, --global-varname <name>', 'Global varname base for transpiled code. Defaults to $_$.', '$_$')
      .option('-d, --disable-instrumentation <x>-<y>', 'advanced option: disable instrumentations x through y at transpile-time', commander.accumulator('disableInstrumentation', commander.coerceDisableInstrumentation), []);
  },
  validate: function (commander) {
    if (!commander.cacheDir) {
      throw new Error('cache-dir required');
    }
  },
  execute: function (commander, state) {
    var path = require('path');
    var fs = require('fs');
    var glob = require('glob');
    var mkdirp = require('mkdirp');
    var ProgressBar = require('progress');
    var hooker = require('../profiler/hooker');

    mkdirp.sync(commander.cacheDir);

    glob(commander.pattern, function (err, files) {
      if (files.length === 0) {
        throw new Error('No files found matching pattern: ' + commander.pattern);
      }

      var state = {
        lastInstId: 0
      };

      var bar = new ProgressBar('Compiling [:bar] :percent :etas', {
        mark:       true,
        complete:   '=',
        incomplete: ' ',
        width:      40,
        total:      files.length*3 + 1
      });

      bar.tick();

      var cacheDir = path.resolve(process.cwd(), commander.cacheDir);

      files = files.filter(function (filename) {
        filename = path.resolve(process.cwd(), filename);
        var stat = fs.statSync(filename);
        bar.tick();
        return stat.isFile() && filename.indexOf(cacheDir) !== 0;
      });

      var hashes = {};
      files.map(function (filename) {
        var hash = hooker.hash(commander, filename);
        if (hash in hashes) {
          var thisSource = fs.readFileSync(filename).toString();
          var otherSource = fs.readFileSync(hashes[hash].filename).toString();
          if (thisSource !== otherSource) {
            throw new Error('Hash conflict: ' + filename + ', ' + hashes[hash]);
          }
        }
        hashes[hash] = { filename: filename };
        bar.tick();
      });

      files.map(function (filename) {
        hooker.compile(commander, state, filename);
        bar.tick();
      });

      console.log('\n');
    });
  }
};
