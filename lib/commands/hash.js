/**
 * yprof hasher.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = {
  description: 'Get the hash of a given source file, for finding a compiled version of code in a cache directory.',
  setupOptions: function (commander) {
    commander.usage('<filename>');
  },
  validate: function (commander) {
    if (commander.args.length !== 1) {
      throw new Error('No filename given');
    }
  },
  execute: function (commander) {
    var fs = require('fs');
    var xxhash = require('xxhashjs');

    var filename = commander.args[0];
    var source = fs.readFileSync(filename).toString();
    var hash = xxhash(source, commander.hashSeed).toString(16);
    console.log(hash);
  }
};
