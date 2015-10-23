/**
 * Instrumentation receiver: receives instrumentation calls directly from the
 *  instrumented code, on the same process. Instrumentation calls are:
 * c, pc, f, e
 *
 * c: wraps values: var x = c(pc(i), someValue);
 * pc: called before a value is executed. Thus, our event stream is pc(i) -> c(i, v)
 * f: called at the beginning of function execution.
 * e: called at the end of function execution.
 *
 * c, f, e are from TraceGL. pc is our own invention to keep stack traces in order.
 * In addition, we are also processing stack traces to gather more data about
 *  asynchronous and synchronous code paths.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

// This maps a stack track frame back to an index (in the sourceDict)
// This is necessary for properly compiling /synchronous/ call graphs.
// We currently do lookups by removing the column number; it is most common that the "set" operation looks like this:
//   reverseLineMap['a (/file.js:10:10)'] = i
// and the "get" operation looks like this:
//   reverseLineMap['a (/file.js:10:16)']
// That is, the column is just slightly higher. Thus, we strip the column and store data like this:
//    reverseLineMap['a (/file.js:10)'] = {
//       16: i
//    }
// Then when we do the lookup, we can grab the closest column in that dictionary.
// This is just in case multiple functions are defined on a single line.
var reverseLineMap = {};

function setReverseLineMap (stackFrame, i) {
	var frameParts = stackFrame.split(':');
	var col = frameParts[2].split(')')[0];
	frameParts.splice(2);
	var frameIndex = frameParts.join(':');
	reverseLineMap[frameIndex] = reverseLineMap[frameIndex] || {};
	reverseLineMap[frameIndex][col] = i;
}

function closest (inAry, num) {
  return inAry.sort(function (a, b) {
    return Math.abs(a-num)-Math.abs(b-num);
  })[0];
}

function getReverseLineMap (stackFrame) {
	var frameParts = stackFrame.split(':');
	if (!frameParts[2]) {
	  return -1;
	}
	var col = frameParts[2].split(')')[0];
	frameParts.splice(2);
	var frameIndex = frameParts.join(':');

	if (!reverseLineMap[frameIndex]) {
		return -1;
	}

	var closestCol = closest(Object.keys(reverseLineMap[frameIndex]), col);
	return reverseLineMap[frameIndex][closestCol];
}

module.exports = function (commander, state) {
	var instrObject = {};
	var sourceDict = state.sourceDict;
	var flatcalls = state.flatcalls;
	var callgraph = state.callgraph;
	var globalVarnameBasename = commander.globalVarname;
	var emptyStackFrame = commander.emptyStackFrame;

	// Because sourceDict entries are sent from instrumented source and the socket
	// I/O operations aren't guaranteed to happen in a particular order, we
	// sometimes need to wait for sourceDict entries.
	var waitForSourceDict = function (sourceIndex, fn, iterations) {
		iterations = (iterations || 0) + 1;

		if (iterations === 1) {
			state.processingOps++;
		}

		if (typeof sourceDict[sourceIndex] === 'undefined') {
			if (state.processingSourceDictOps === 0 && iterations > (state.processingOps+1)*100) {
				throw new Error('Waited maximum number of iterations for sourceDict entry ' + sourceIndex);
			}

			return setTimeout(function () {
				return waitForSourceDict(sourceIndex, fn, iterations);
			}, 5);
		} else {
			fn();
			state.processingOps--;
		}
	};

	// Pre-report a value: this wraps the id (i) before some value is computed.
	instrObject.pc = function (i, terminalStackFrame, fnid) {
		setReverseLineMap(terminalStackFrame, i);
		waitForSourceDict(i, function () {
			sourceDict[i].ret = fnid;
		});
	};
  // "function call entry"
	// Not called 100% of the time from localInstrumentationReceiver; only called
	//  here when we need to update the terminalStackFrame.
  // i: sourceDict index
  instrObject.f = function (i, terminalStackFrame) {
		setReverseLineMap(terminalStackFrame, i);
  };
	// function exit
  // i: sourceDict index
  // v: wrapped value
  instrObject.e = function (i, stack, timeNow, an) {
		var x = i;
		waitForSourceDict(i, function () {
			var i = x; // For some reason `i` here is undefined otherwise. Am I going crazy?
			var endTime = timeNow;
			var startTime = an.startTime;
	    var functionIndex = sourceDict[i].ret = an.fnid;
			var elapsed = (endTime - startTime);

			// Record call in call graph
			var callgraphRecord = callgraph;
			for (var i in stack) {
				var initial = (i == 0 && 1 || 0), // do not use ===, indices of stack are strings
				  terminal = (initial === 0 && i == stack.length - 1 && 1 || 0), // do not use ===, indices of stack are strings
					middle = (!initial && !terminal && 1 || 0),
					sourceEntry = sourceDict[getReverseLineMap(stack[i])],
					fnid = sourceEntry ? sourceEntry.ret : -1,
					fnEntry = sourceDict[fnid] || null,
					frameStr = fnEntry && fnEntry.name || stack[i];
				callgraphRecord.subcalls = callgraphRecord.subcalls || {};
				callgraphRecord.subcalls[frameStr] = callgraphRecord.subcalls[frameStr] || {};
				callgraphRecord = callgraphRecord.subcalls[frameStr];
				callgraphRecord.fnid = fnid;
				if (terminal) {
					callgraphRecord.calls = (callgraphRecord.calls || initial) + middle + terminal;
					callgraphRecord.callRecords = (callgraphRecord.callRecords || []);
					callgraphRecord.callRecords.push([startTime, endTime]);
				}
			}

			// Take care of flat calls
	    flatcalls[functionIndex] = flatcalls[functionIndex] || {};
	    flatcalls[functionIndex].i = functionIndex;
	    flatcalls[functionIndex].calls = (flatcalls[functionIndex].calls || 0) + 1;
	    flatcalls[functionIndex].callTimesTotal = (flatcalls[functionIndex].callTimesTotal || 0) + elapsed;
		});
  };

	return instrObject;
};
