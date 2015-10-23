/*
 * HTML formatter for yprof.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var tmp = require('tmp');
var wrench = require('wrench');
var Inliner = require('inliner');
var browserify = require('browserify');
var path = require('path');
var fs = require('fs');

var rmdir = function(dir) {
	var list = fs.readdirSync(dir);
	for(var i = 0; i < list.length; i++) {
		var filename = path.join(dir, list[i]);
		var stat = fs.statSync(filename);

		if(filename == '.' || filename == '..') {
			// pass these files
		} else if(stat.isDirectory()) {
			// rmdir recursively
			rmdir(filename);
		} else {
			// rm fiilename
			fs.unlinkSync(filename);
		}
	}
	fs.rmdirSync(dir);
};

function isCircularObject(node, parents){
  parents = parents || [];

  if(!node || typeof node != 'object'){
    return false;
  }

  var keys = Object.keys(node), i, value;

  parents.push(node); // add self to current path
  for(i = keys.length-1; i>=0; i--){
    value = node[keys[i]];
    if(value && typeof value == 'object'){
      if(parents.indexOf(value)>=0){
        // circularity detected!
        return true;
      }
      // check child nodes
      if(arguments.callee(value, parents)){
        return true;
      }
    }
  }
  parents.pop(node);
  return false;
}

module.exports = function (data, commander, cb) {
  var tmpDir = tmp.dirSync();
  var dir = tmpDir.name;

  wrench.copyDirSyncRecursive(path.join(__dirname, 'html/'), dir, {
    forceDelete: true,
    excludeHiddenUnix: true,
    preserveFiles: false,
    preserveTimestamps: true,
    inflateSymlinks: false,
    filter: /.*/,
    whitelist: false,
    include: /.*/,
    exclude: null
  });

  var options = {};
  Object.keys(commander).map(function (key) {
    if (typeof commander[key] !== 'function' && !isCircularObject(commander[key])) {
      options[key] = commander[key];
    }
  });

  // Create bundle using browserify
  browserify([path.join(__dirname, 'html/frontend.js')]).bundle(function (err, buf) {
    if (err) {
      throw err;
    }

    fs.writeFileSync(path.join(dir, 'bundle.js'), buf.toString());

		var instanceGlobalsSrc = 'window.__defaultCommanderOptions = '+JSON.stringify(options)+';'
			+ 'window.__rawTraceData = ' + JSON.stringify(data) + ';';
    fs.writeFileSync(path.join(dir, 'instance-globals.js'), instanceGlobalsSrc);

		var inlinerOptions = {
			collapseWhitespace: false,
			compressCSS: true,
			images: true
		};

    new Inliner(path.join(dir, 'index.html'), inlinerOptions, function (html) {
      // compressed and inlined HTML page
      cb(html);
    });
  });
};
module.exports.isRaw = true;
