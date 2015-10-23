/**
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

// These are all relative times in nanoseconds. Don't try to correlate them to
//  actual clock times.
var getNow = require('performance-now');

var haveReverseLineMap = {};
var haveTerminalStackFrame = {};

// Take care of call graph
// #x in a stack frame indicates that x is the line ID
var nextLineIsAsync = false;
var cwd = process.cwd();
var processStack = function (originalStack, emptyStackFrame) {
	// Remove the first line of the stack, which is something in yprof
	var stack = originalStack.replace(/^Error\s*/, '').split("\n").slice(1).join("\n");

	var i = 0;
	stack = stack.split("\n").map(function (line) {
		if (line.indexOf(__filename) !== -1) {
			return null;
		}
		if (line.indexOf() !== -1 || line.indexOf('/yprof/lib/') !== -1 || line.indexOf('/yprof/node_modules/') !== -1) {
			// allow bluebird to be instrumented for our test code
			if (line.indexOf('bluebird') === -1) {
				return null;
			}
		}

		return line.replace(/^\s*at\s*(.*?)$/, '$1').replace(cwd, "");
	}).reverse().map(function (line) {
		if (line === emptyStackFrame) {
			nextLineIsAsync = true;
			return null;
		}

		if (line) {
			i++;
		}

		if (nextLineIsAsync) {
			nextLineIsAsync = false;
			return line + ' <async>';
		}

		// Skip this line since it wouldn't exist without yprof including the user code
		if (i === 1 && line && line.indexOf('require (module.js:380:17)') !== -1) {
			return null;
		}

		return line;
	}).filter(function (line) {
		return !!line;
	});

	return stack;
}

// Can only be called once. After the first require(), instead of this initializer
//  function, module.exports becomes the instrObject.
module.exports = function (commander, state, writeToServer) {
	var instrObject = {};
	var globalVarnameBasename = commander.globalVarname;
	var emptyStackFrame = commander.emptyStackFrame;

	// Report a sourceDict entry
	instrObject.s = function (obj) {
	    writeToServer({ type: 's', o: obj });
	};
  // Report a value
	// TraceGL comments this as: callsite annotation for last return
  // I think this means: we're trying to keep track of the call stack, and to
  //  do this we instrument every single line. If the stack suddenly changes underneath
  //  us we can detect an event loop tick.
  // This is called with an index and a value. The transformed source expects
  //  the value to be returned unmodified.
  // The `v` here can be used to trace values through the stack, but we don't
  //  do that currently.
	// c() has been disabled in instrumented source for now.
  instrObject.c = function (i, v) {
    //server.write(JSON.stringify({ type: 'c', i: i }) + "\n");
    return v;
  };
	// Pre-report a value: wrap a value before it is called.
	instrObject.pc = function (i, an) {
		if (!(i in haveReverseLineMap)) {
			haveReverseLineMap[i] = true;
			var stack = processStack(new Error().stack, emptyStackFrame);
			var stackFrame = stack[stack.length - 1];
      writeToServer({ type: 'pc', i: i, fnid: an.fnid, terminalStackFrame: stackFrame });
		}
		return i;
	};
  // "function call entry"
  // i: sourceDict index
	// an: annotation local to function closure
  instrObject.f = function (an) {
		var i = an.fnid;
		an.startTime = getNow();
    if (!(i in haveTerminalStackFrame)) {
      haveTerminalStackFrame[i] = true;
			var stack = processStack(new Error().stack, emptyStackFrame);
			var terminalStackFrame = stack[stack.length - 1];
      writeToServer({ type: 'f', i: i, terminalStackFrame: terminalStackFrame });
    }
  };
	// function exit
  // i: sourceDict index
  // v: wrapped value
  instrObject.e = function (i, an, v) {
		var stack = processStack(new Error().stack, emptyStackFrame);

    writeToServer({ type: 'e', i: i, stack: stack, t: getNow(), an: an });

		return v;
  };

	module.exports = instrObject;
};
