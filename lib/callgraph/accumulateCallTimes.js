/**
 * Given a tree of call times [start, finish], calculate total call time of this function,
 *  and (recursive) synchronous and (recursive) asynchronous children times.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var crStartTime = 0;
var crEndTime = 1;
var crChildrenSync = 2;

module.exports = function accumulate (callgraph) {
	if (callgraph.subcalls) {
		Object.keys(callgraph.subcalls).map(function (frameName) {
			var subcall = accumulate(callgraph.subcalls[frameName]);
			//console.log('accumulated subcalls of', frameName, JSON.stringify(subcall, null, 2));

			var timeSelf = 0;
			var maxSyncTime = 0;
			var childrenSyncTime = 0;
			var childrenAsyncTime = 0;
			var descendentsAsyncTime = 0;

			// Calculate time spent in self, and synchronous children
			// We know that all calls are sorted by start time.
			if (subcall.callRecords) {
				var maxSubcallCR = subcall.callRecords.length - 1;
				var knownSyncCalls = {};
				for (var i = 0; i < (maxSubcallCR + 1); i++) {
					var callRecord = subcall.callRecords[i];
					var lastSubcallCR = (i === maxSubcallCR);
					var callTime = (callRecord[crEndTime] - callRecord[crStartTime]);
					callRecord[crChildrenSync] = 0;
					timeSelf += callTime;
					maxSyncTime = (callTime > maxSyncTime ? callTime : maxSyncTime);

					// Iterate through all child calls
					// This is super expensive! TODO: efficiencize this somehow?
					if (subcall.subcalls) {
						Object.keys(subcall.subcalls).map(function (childFrameName) {
							var childCall = subcall.subcalls[childFrameName];
							knownSyncCalls[childFrameName] = knownSyncCalls[childFrameName] || [];

							if (childCall.callRecords) {
								var maxChildCallCR = childCall.callRecords.length - 1;
								for (var j = 0; j < (maxChildCallCR + 1); j++) {
									var childCallRecord = childCall.callRecords[j];
									var isSync = childCallRecord[crStartTime] > childCallRecord[crStartTime] && childCallRecord[crEndTime] < childCallRecord[crEndTime];
									var isAsync = !isSync && lastSubcallCR && knownSyncCalls[childFrameName].indexOf(j) === -1;
									var childTime = (childCallRecord[crEndTime] - childCallRecord[crStartTime]) + childCallRecord[crChildrenSync];

									if (isSync) {
										knownSyncCalls[j] = true;
										callRecord[crChildrenSync] += childTime;
										childrenSyncTime += childTime;
									}
									if (isAsync) {
										childrenAsyncTime += childTime;
									}
								}
							}
						});
					}
				}
			}

			// Accumulate async times of children / descendents
			if (subcall.subcalls) {
				Object.keys(subcall.subcalls).map(function (childFrameName) {
					var childCall = subcall.subcalls[childFrameName];
					descendentsAsyncTime += childCall.childrenAsyncTime;

					// No call information for this subcall: probably a stack frame in the stack that we didn't instrument,
					//  implying Node internals / compiled module => probably asynchronous call calling our code synchronously.
					if (!subcall.callRecords) {
						childrenSyncTime += childCall.callTimesTotal;
					}
					// No call information for this child: if it's annotated with <async> then we know it was caught
					//  as an asychronous call in the stack trace. Otherwise, we assume it's synchronous.
					if (!childCall.callRecords) {
						if (childFrameName.indexOf('<async>') !== -1) {
							childrenAsyncTime += childCall.childrenSyncTime;
						} else {
							childrenSyncTime += childCall.childrenSyncTime;
						}
					}
				});
			}

			subcall.maxSyncTime = maxSyncTime;
			subcall.avgSyncTime = (timeSelf / subcall.calls);
			subcall.callTimesTotal = timeSelf;
			subcall.childrenSyncTime = childrenSyncTime;
			subcall.childrenAsyncTime = childrenAsyncTime + descendentsAsyncTime;
		});
	}

	return callgraph;
};
