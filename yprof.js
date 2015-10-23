#!/usr/bin/env node
/**
 * Node.js profiler, inspired by TraceGL.
 *
 * TraceGL archaeology:
 * 1) TraceGL first generates a parse tree of source using Acorn.
 * 2) TraceGL iteratively runs through each function in the parse tree.
 * 3) TraceGL instruments each function, statement, and control-flow statement in the codebase,
 *     storing an extensive dictionary of code locations at instrumentation-time. These IDs
 *     are used within instrumented source to reduce the amount of data collected at runtime.
 * 4) This extensive data collection at runtime and instrumentation-time allows TraceGL to
 *     track code-flow very reliably at runtime.
 * 5) TraceGL does not use long stack traces or any other stack tricks, and thus is not able to trace
 *     asynchronous code paths.
 *
 * To address TraceGL's deficiency at point #5, we use Longjohn to create long stack traces
 *  which help create call graphs of asynchronous code. This makes the library, as it exists, only compatible with v8.
 * Longjohn can create a *lot* of memory pressure so this decision is worth revisiting and optimizing.
 * We use one other trick which is the `reverseLineMap` of name/file/line/(fuzzy)column to make stack traces unambiguous.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var version = require('./package.json').version;
var path = require('path');
var fs = require('fs');
var getNow = require('performance-now');
var commander = require('commander');
var formatters = require('./lib/formatters/');
var commands = require('./lib/commands/');

// Customize options to the CLI entry-point
// yprof, profiler (profiler.js), yprof-hash, yprof-compile
var binary = path.basename(process.argv[1], '.js');

// You think you're clever, huh?
if (typeof commands[binary] === 'undefined') {
  binary = 'yprof';
  process.argv.splice(2, 0, '--help');
}

// For profiler and yprof, pull out options that come out of the binary
// for example: `yprof --format=raw server.js --port 1337`, we want to parse
//  everything before `server.js` and nothing after it.
// This also causes commander to throw errors on anything bad before the `server.js`.
var subcommand;
if (commands[binary].processSubcommand) {
  for (var i = 2, arg; arg = process.argv[i]; i++) {
    if (arg.indexOf('--') !== 0 && fs.existsSync(arg)) {
      subcommand = process.argv.splice(i);
      break;
    }
  }
}

// Common accumulator helper
commander.accumulator = function (field, fn) {
  return function (a) {
    return (commander[field] || []).concat(fn ? fn(a) : a);
  };
};

// Parse disableInstrumentation options
commander.coerceDisableInstrumentation = function (arg) {
  if (arg.indexOf('-') === -1) {
    return arg;
  }

  var rangeParts = arg.split('-');
  var rangeParts1 = rangeParts[0].split(':');
  var rangeParts2 = rangeParts[1].split(':');
  var invariant = rangeParts1.length > 1 && rangeParts1[0] || '';
  var invariant2 = rangeParts2.length > 1 && rangeParts2[0] || '';
  var rangeBegin = rangeParts1[invariant === '' ? 0 : 1];
  var rangeEnd = rangeParts2[invariant === '' ? 0 : 1];

  if (invariant !== invariant2) {
    throw new Error('Invalid range: ' + arg);
  }
  if (parseInt(rangeBegin) != rangeBegin || parseInt(rangeEnd) != rangeEnd) {
    throw new Error('Invalid range: ' + arg);
  }
  if (rangeBegin >= rangeEnd) {
    throw new Error('Invalid range: ' + arg);
  }

  var res = [];
  for (var i = rangeBegin; i <= rangeEnd; i++) {
    res.push((invariant ? invariant + ':' : '') + i);
  }
  return res;
};

// Hash seed for file hashing
commander.hashSeed = 0xABCF;

commands[binary].setupOptions(commander
  .version(version)
  .description(binary + ', ' + commands[binary].description));
try {
  commander.parse(process.argv);
  if (subcommand) {
    commander.args = commander.args.concat(subcommand);
  }
  commands[binary].validate(commander);
} catch (e) {
  console.log('Error: ', e);
  commander.help();
}

commands[binary].execute(commander);
