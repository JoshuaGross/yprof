/**
 * Given a callgraph and a list of frame strings, remove those frames from the call graph
 *  and merge their children into their parents.
 * a -> listTimeout -> b, cut "listTimeout" => a -> b
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

function frameIsAsync (frameName) {
	return ((frameName || '').indexOf('<async>') !== -1);
}

/**
 * Merge subcalls `ext` into subcalls of `base`.
 *
 * The `isAsync` param is a bit wonky. Basically if the frame that we are
 *  /collapsing/ is an async frame, we want to treat all its child frames as
 *  async. However, *their* children should not be assumed to async after that.
 *  Thus, in recursion, this parameter is always false.
 */
function mergeSubcalls (base, ext, isAsync) {
	var parent = ext;

	base.subcalls = base.subcalls || {};
	ext.subcalls = ext.subcalls || {};

	isAsync = isAsync || (base.asyncCalls > 0 && (parent.calls || 0) === 0);

	Object.keys(ext.subcalls).map(function (frameName) {
		base.subcalls[frameName] = base.subcalls[frameName] || {};
		var subcall = base.subcalls[frameName];
		var subcallExt = ext.subcalls[frameName];

		subcall.fnid = subcall.fnid || subcallExt.fnid;
		subcall.maxSyncTime = (subcall.maxSyncTime || 0) + (subcallExt.maxSyncTime || 0);
		subcall.callTimesTotal = (subcall.callTimesTotal || 0) + (subcallExt.callTimesTotal || 0);
		subcall.childrenSyncTime = (subcall.childrenSyncTime || 0) + (subcallExt.childrenSyncTime || 0);
		subcall.childrenAsyncTime = (subcall.childrenAsyncTime || 0) + (subcallExt.childrenAsyncTime || 0);

		if (subcall.calls || subcallExt.calls || subcall.asyncCalls || subcallExt.asyncCalls) {
			// Get share of parent calls that are sync/async, keeping in mind the parent is being collapsed.
			// There are a few scenarios we care about:
			// 1) Parent is 100% async, we are 100% sync. We become 100% async.
			// 2) Parent is 0-100% async, we are 100% async. No change.
			// 3) Parent is mixed sync/async, and we are >0% sync. Our # of sync calls should be <= number of parent sync calls.
			var mainKey = (isAsync ? 'asyncCalls' : 'calls');
			subcall[mainKey] = (subcall[mainKey] || 0) + (subcallExt.calls || 0)
				+ (mainKey === 'asyncCalls' ? (subcallExt.asyncCalls || 0) : 0);

			if (!isAsync) {
				subcall.asyncCalls = (subcall.asyncCalls || 0) + (subcallExt.asyncCalls || 0);
			}

			// If our parent is partially sync/async, the min number of /our/ sync calls
			//  is the number of our parent's sync calls, since it is being collapsed.
			var parentCallsTotal = ((parent.calls || 0) + (parent.asyncCalls || 0));
			var ourCallsTotal = ((subcall.calls || 0) + (subcall.asyncCalls || 0));
			if (!isAsync && parent.asyncCalls > 0 && parentCallsTotal <= ourCallsTotal) {
				var syncCalls = subcall.calls;
				var minSyncCalls = Math.min(parent.calls || 0, syncCalls);
				var missingSyncCalls = (syncCalls - minSyncCalls);
				subcall.calls = minSyncCalls;
				subcall.asyncCalls = subcall.asyncCalls + missingSyncCalls;
			}
		}
		if (subcall.callRecords || subcallExt.callRecords) {
			subcall.callRecords = (subcall.callRecords || []).concat(subcallExt.callRecords || []).sort(function (a, b) {
				return b[0] - a[0];
			});
		}

		mergeSubcalls(subcall, subcallExt, false);
	});
}

/**
 * Mutates the callgraph passed in.
 */
module.exports = function collapse (commander, callgraph) {
	var removeFrames = JSON.parse(JSON.stringify(commander.collapseFrame));

  // Automatically collapse module load frames
  if (commander.collapseModuleLoadFrames) {
		removeFrames.push('Module.require (module.js:364:17)');
		removeFrames.push('Function.Module._load (module.js:312:12)');
    removeFrames.push('Module._load (module.js:312:12)');
		removeFrames.push('Module.load (module.js:356:32)');
		removeFrames.push('require (module.js:380:17)');
		removeFrames.push('Object.Module._extensions.(anonymous function) [as .js] (/node_modules/node-hook/index.js:52:14)');
		removeFrames.push('Module._compile (module.js:456:26)');
  }

	return collapsePrime(callgraph, removeFrames);
};

function collapsePrime (callgraph, removeFrames) {
	Object.keys(callgraph.subcalls || []).map(function (frameName) {
		var subcall = callgraph.subcalls[frameName];

		if (removeFrames.indexOf(frameName) !== -1) {
			mergeSubcalls(callgraph, collapsePrime(subcall, removeFrames), frameIsAsync(frameName));

			delete callgraph.subcalls[frameName];
		} else {
			callgraph.subcalls[frameName] = collapsePrime(subcall, removeFrames);
		}
	});

	return callgraph;
}
