/**
 * Source code require hook.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var instrumenter = require('./sourceInstrumenter');
var getNow = require('performance-now');
var xxhash = require('xxhashjs');
var path = require('path');
var fs = require('fs');

var hooked = false;

function getSourceHash (commander, source) {
	return xxhash(source, commander.hashSeed).toString(16);
}

function instrumentRequiredFile (commander, state) {
	return function instrumentRequiredFile$2 (source, filename, recompile) {
		// Let's just disable all node_modules for now.
		// We can gradually ease this restriction as parsing and instrumentation become faster.
		if (filename.indexOf('node_modules') !== -1) {
	    return source;
	  }

		// We do not play well with anything that transpiles right now: React, uglify, babel
		if (filename.indexOf('node_modules/react') !== -1 || filename.indexOf('node_modules/uglify-js') !== -1 || filename.indexOf('node_modules/babel') !== -1) {
			return source;
		}

		if (filename.indexOf('/yprof/profiler.js') !== -1 || filename.indexOf('/yprof/node_modules') !== -1 || filename.indexOf('/yprof/lib') !== -1) {
	    return source;
	  }

		var cachedFilename, sourceHash;
		if (commander.cacheDir) {
			// We use source hash instead of filename hash so that behaviour is
			// consistent for the same files across environments with different paths.
			sourceHash = getSourceHash(commander, source);
			cachedFilename = path.join(commander.cacheDir, sourceHash + '.js');

			if (fs.existsSync(cachedFilename) &&!recompile) {
				return fs.readFileSync(cachedFilename).toString();
			}
		}

		if (commander.cacheOnly) {
			return source;
		}

		var instrumentedCode = instrumenter(commander, state, filename, source, sourceHash);
		if (cachedFilename) {
			fs.writeFileSync(cachedFilename, instrumentedCode);
		}
		return instrumentedCode;
	};
}

module.exports = {
  hook: function (commander, state) {
    if (hooked) {
      return false;
    }

    hooked = true;

		var superstack = require('superstack');
		superstack.empty_frame = commander.emptyStackFrame;
		superstack.async_trace_limit = -1;

    var hooker = require('node-hook');
    hooker.hook('.js', instrumentRequiredFile(commander, state, false));

    return true;
  },
	compile: function (commander, state, filename) {
		var source = fs.readFileSync(filename).toString();
    try {
			instrumentRequiredFile(commander, state)(source, filename, true);
    } catch (e) {
			console.log('Error parsing', filename, '\n-----\n', source, '\n-----\n');
			throw e;
    }
	},
	hash: function (commander, filename) {
		var source = fs.readFileSync(filename).toString();
		return getSourceHash(commander, source);
	}
}
