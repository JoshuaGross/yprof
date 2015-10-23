/**
 * yprof script runner.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = {
  description: 'Script runner for yprof (run automatically by yprof; this is for internal use only, unless you\'re doing something crazy).',
  processSubcommand: true,
  setupOptions: function (commander) {
    commander
      .option('-p, --parent-port <port>', 'Port of socket on parent `yprof` process.')
      .option('-g, --global-varname <name>', 'Global varname base for transpiled code. Defaults to $_$.', '$_$')
      .option('-e, --empty-stack-frame <str>', 'Text in between two async frames.', '---------------------------------------------')
      .option('-d, --disable-instrumentation <x>-<y>', 'advanced option: disable instrumentations x through y at transpile-time', commander.accumulator('disableInstrumentation', commander.coerceDisableInstrumentation), [])
      .option('-c, --cache-dir <dir>', 'Cache directory for transpiled sources')
      .option('--cache-only', 'Only run code from cache directory. Nothing will be recompiled, uncompiled source will be run as-is. Off by default.');
  },
  validate: function (commander) {
  },
  execute: function (commander) {
    var net = require('net');
    var path = require('path');
    var hooker = require('../profiler/hooker');

    // Trick userland into thinking it's being run normally and standalone. Magic!
    process.argv = commander.args;

    var state = {
      flatcalls: {},
      linebyline: {},
      callgraph: {},
      lastInstId: 0
    };

    var connecting = false;
    var currentConnection = null;
    var killConnectionTimer = null;

    var setKillTimer = function () {
      clearTimeout(killConnectionTimer);
      killConnectionTimer = setTimeout(function () {
        currentConnection.end();
        currentConnection = null;
      }, 100);
    };

    // We attempt to kill the connection to the server every 100 ms; this is so that
    //  if this process would die otherwise, that connection won't keep it alive.
    var writeToServer = function (msg) {
      if (currentConnection) {
        setKillTimer();
        currentConnection.write(JSON.stringify(msg)+"\n");
      } else if (connecting) {
        setTimeout(writeToServer, 0, msg);
      } else {
        createConnection(function () {
          currentConnection.write(JSON.stringify(msg)+"\n");
        });
      }
    }.bind(this);

    // Create local instrumentation object
    require('../profiler/localInstrumentationReceiver.js')(commander, state, writeToServer);

    var onConnect = function () {
      currentConnection = this;
      connecting = false;

      setKillTimer();

      if (hooker.hook(commander, state)) {
        require(path.join(process.cwd(), process.argv[1]));
      }
    };

    var createConnection = function (cb) {
      connecting = true;
      net.createConnection({ port: commander.parentPort }, function () {
        onConnect.apply(this);
        if (cb) {
          cb();
        }
      });
    };

    createConnection();
  }
};
