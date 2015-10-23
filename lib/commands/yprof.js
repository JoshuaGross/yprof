/**
 * yprof - main command.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = {
  description: 'JavaScript performance profiler. Built by Joshua Gross <joshua.gross@gmail.com>, Copyright 2015 Yahoo Inc.',
  processSubcommand: true,
  setupOptions: function (commander) {
    var fs = require('fs');
    var formatters = require('../formatters/');

    var coerceFormatter = function (formatterName) {
      return formatters[formatterName];
    };

    var coerceOutfile = function (filename) {
      return fs.createWriteStream(filename);
    };

    commander
      .option('-i, --infile <infile>', 'Optional input file if not running a file. Input file contains raw trace data (produced with `yprof --outfile=trace.out --format=raw file.js`)')
      .option('-o, --outfile <outfile>', 'Output file, defaults to stdout', coerceOutfile, process.stdout)
      .option('-f, --format <format>', 'Format, defaults to `gprof-flat`. Formats available: {' + Object.keys(formatters).join(', ') + '}', coerceFormatter, formatters['gprof-flat'])
      .option('-c, --cache-dir <dir>', 'Cache directory for transpiled sources')
      .option('--cache-only', 'Only run code from cache directory. Nothing will be recompiled, uncompiled source will be run as-is. Off by default.')
      .option('--collapse-module-load-frames', 'remove lots of stack frames that are usually not helpful')
      .option('--collapse-frame <x>', 'remove stack frame "x" without loss of data or hierachy', commander.accumulator('collapseFrame'), [])
      .option('-d, --disable-instrumentation <x>-<y>', 'advanced option: disable instrumentations x through y at transpile-time', commander.accumulator('disableInstrumentation', commander.coerceDisableInstrumentation), [])
      .option('-g, --global-varname <name>', 'Global varname base for transpiled code. Defaults to $_$.', '$_$')
      .option('-e, --empty-stack-frame <str>', 'Text in between two async frames.', '---------------------------------------------');
    commander.on('--help', function () {
      console.log('');
      console.log('Examples:');
      console.log('  `yprof test/examples/async.js` -- profiles async.js demo, defaults to gprof-flat format');
      console.log('  `yprof /path/to/my/server.js` -- run your server under yprof. ctrl-c to kill and see output');
      console.log('  `yprof test/examples/async.js --outfile=trace.out --format=raw` -- save raw trace data');
      console.log('  `yprof --infile=trace.out --format=gprof-callgraph` -- show gprof-callgraph of trace.out');
      console.log('');
      console.log('Code caching with --cacheDir:');
      console.log('  You can improve reliability of results by using --cacheDir to cache instrumented');
      console.log('   code on disk. After the 1st yprof run, results will be more reliable because ');
      console.log('   instrumentation time will be reduced dramatically. Startup will also be faster.');
      console.log('  If you intend to run yprof in production, it is also reasonable to use a --cacheDir');
      console.log('   and check the results into your SCM.');
      console.log('  To get the hash of a particular source file, run `yprof-hash /path/to/file`');
      console.log('');
    });
  },
  validate: function (commander) {
    if (commander.args.length < 1 && !commander.infile) {
      throw new Error("No file provided.");
    }
    if (commander.cacheOnly && !commander.cacheDir) {
      throw new Error("In --cache-only mode, you must provide a --cache-dir.");
    }
  },
  execute: function (commander) {
    var getNow = require('performance-now');
    var path = require('path');
    var fs = require('fs');
    var spawn = require('child_process').spawn;
    var accumulateCallTimes = require('../callgraph/accumulateCallTimes');
    var collapseCallGraph = require('../callgraph/collapse');

    var state = {
      flatcalls: {},
      linebyline: {},
      callgraph: {},

      // The sourceDict data format is the same as TraceGL's `dict` format.
      // sourceDict entries are keyed on [i] from sourceInstrumenter.js, a unique ID of
      //  some element of code that has been instrumented.
      // The keys of value objects mean:
      // x  -> column
      // y  -> line
      // ex -> end column
      // ey -> end line
      // sx -> start column
      // sy -> start line
      // n  -> name of function / file
      // a  -> used to capture positions of arguments to function call (ce)
      // ce -> type: 'callExpression'
      // c  -> "context" (not from TraceGL), the sourceDict index of enclosing context (function or function invocation)
      sourceDict: {}
    };

  	var startTime = getNow();

    var completeExecution =  function (data) {
      data.args = commander.args;
      if (!(commander.format && commander.format.isRaw)) {
    		data.callgraph = accumulateCallTimes(data.callgraph);
    		data.callgraph = collapseCallGraph(commander, data.callgraph);
      }

      var callback = function (output) {
        commander.outfile.write(output+"\n");
        process.exit();
      };

      var formatOutput = commander.format(data, commander, callback);
      if (commander.format.length < 3) {
        callback(formatOutput);
      }
    };

    if (commander.infile) {
      // Read previous trace information from an input file, parse the JSON,
      //  and then output in whatever requested format.
      return completeExecution(JSON.parse(fs.readFileSync(commander.infile).toString()));
    } else {
      // Start up listening TCP server to receive events
      var net = require('net');
      var server = net.createServer(function (c) {
        var instrumentationReceiver = require('../profiler/instrumentationReceiver.js')(commander, state);

        var prevData = '';
        c.on('data', function (dComplete) {
          dComplete.toString().split("\n").map(function (d) {
            if (!d) {
              return;
            }

            // Sometimes an entry will be split across two separate `data` events.
            // Except for entries with extremely large stack traces (megabytes!)
            //  it should be split into two parts, maximum - thus we guarantee
            //  that prevData is empty if we fail to parse, and always set prevData,
            //  never append.
            try {
              d = JSON.parse(prevData + d);
              prevData = '';
            } catch (e) {
              if (prevData !== '') {
                throw e;
              }
              prevData = d;
              return;
            }

            if (d.type === 's') {
              Object.keys(d.o).map(function (k) {
                state.sourceDict[k] = d.o[k];
              });
            } else if (d.type === 'pc') {
              instrumentationReceiver.pc(d.i, d.terminalStackFrame, d.fnid);
            } else if (d.type === 'f') {
              instrumentationReceiver.f(d.i, d.terminalStackFrame);
            } else if (d.type === 'e') {
              instrumentationReceiver.e(d.i, d.stack, d.t, d.an);
            } else {
              throw new Error('Unknown instrumentation message: ' + JSON.stringify(d));
            }
          });
        });
      });
      server.listen(0, function (err, cb) {
        var instrArgs = [
          '--parent-port=' + server.address().port,
          '--empty-stack-frame=' + commander.emptyStackFrame,
          '--global-varname=' + commander.globalVarname,
          (commander.cacheDirectory ? '--cache-dir=' + commander.cacheDirectory : ''),
          (commander.cacheOnly ? '--cache-only' : '')
        ].filter(function (arg) {
          return !!arg;
        });
        var disabledInstrumentationsArg = commander.disableInstrumentation.map(function (i) {
          return '--disable-instrumentation=' + i;
        });
        var args = [process.argv[0]]
          .concat(disabledInstrumentationsArg)
          .concat(instrArgs)
          .concat(commander.args);
        var child = spawn(path.join(__dirname, '../../yprof-run.js'), args, {
          detached: false,
          env: process.env,
          stdio: [process.stdin, process.stdout, process.stderr]
        });

        child.on('exit', function () {
      		var endTime = getNow();
      		var elapsedTimeTotal = endTime - startTime;
          var data = {
            startTime: startTime,
            endTime: endTime,
            elapsedTimeTotal: elapsedTimeTotal,
            flatcalls: state.flatcalls,
            callgraph: state.callgraph,
            sourceDict: state.sourceDict
          };
          completeExecution(data);
        });

        process.on('SIGINT', function () {
          child.kill();
        });
      });
    }
  }
};
