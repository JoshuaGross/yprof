/**
 * Accumulate each function referenced and construct a list of its callers and callees.
 * Count and sort by cumulative time spent in each function - including, for now,
 *  time of its asynchronous children.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = function (callgraph) {
	var accumulate = function (frameName, callgraph) {
		var result = {};
		result[frameName] = {
			selfTime: callgraph.callTimesTotal || 0,
			childrenSyncTime: callgraph.childrenSyncTime || 0,
			childrenAsyncTime: callgraph.childrenAsyncTime || 0,
			calls: callgraph.calls || 0,
			parents: {}, children: {},
		};

		if (callgraph.subcalls) {
			var subresultsAry = Object.keys(callgraph.subcalls).map(function (subFrameName) {
				return accumulate(subFrameName, callgraph.subcalls[subFrameName]);
			});
			// Copy accumulative data for current frame
			Object.keys(callgraph.subcalls).map(function (subFrameName) {
				subresultsAry.map(function (subresults) {
					if (subresults[subFrameName]) {
						result[frameName].totalTime += subresults[subFrameName].totalTime;
						result[frameName].children[subFrameName] = result[frameName].children[subFrameName] || {};
						result[frameName].children[subFrameName].calls = result[frameName].children[subFrameName].calls || 0;
						result[frameName].children[subFrameName].calls += subresults[subFrameName].calls;
						result[frameName].children[subFrameName].selfTime = result[frameName].children[subFrameName].selfTime || 0;
						result[frameName].children[subFrameName].selfTime += subresults[subFrameName].selfTime;
						result[frameName].children[subFrameName].childrenSyncTime = result[frameName].children[subFrameName].childrenSyncTime || 0;
						result[frameName].children[subFrameName].childrenSyncTime += subresults[subFrameName].childrenSyncTime;
						result[frameName].children[subFrameName].childrenAsyncTime = result[frameName].children[subFrameName].childrenAsyncTime || 0;
						result[frameName].children[subFrameName].childrenAsyncTime += subresults[subFrameName].childrenAsyncTime;
						result[subFrameName] = result[subFrameName] || {};
						result[subFrameName].parents = result[subFrameName].parents || {};
						result[subFrameName].parents[frameName] = result[subFrameName].parents[frameName] || {};
						result[subFrameName].parents[frameName].calls = result[subFrameName].parents[frameName].calls || 0;
						result[subFrameName].parents[frameName].calls += callgraph.subcalls[subFrameName].calls;
					}
				});
			});
			// Make sure all data about all functions is preserved at the top results level (smart merge)
			subresultsAry.map(function (subresults) {
				Object.keys(subresults).map(function (subFrameName) {
					result[subFrameName] = result[subFrameName] || {};
					result[subFrameName].calls = (result[subFrameName].calls || 0) + subresults[subFrameName].calls;
					result[subFrameName].selfTime = (result[subFrameName].selfTime || 0) + subresults[subFrameName].selfTime;
					//result[subFrameName].totalTime = (result[subFrameName].totalTime || 0) + subresults[subFrameName].childrenSyncTime;
					result[subFrameName].childrenSyncTime = (result[subFrameName].childrenSyncTime || 0) + subresults[subFrameName].childrenSyncTime;
					result[subFrameName].childrenAsyncTime = (result[subFrameName].childrenAsyncTime || 0) + subresults[subFrameName].childrenAsyncTime;
					result[subFrameName].parents = result[subFrameName].parents || {};
					for (var k in subresults[subFrameName].parents) {
						result[subFrameName].parents[k] = result[subFrameName].parents[k] || {};
						result[subFrameName].parents[k].calls = (result[subFrameName].parents[k].calls || 0);
					  result[subFrameName].parents[k].calls += subresults[subFrameName].parents[k].calls;
					}
					result[subFrameName].children = result[subFrameName].children || {};
					for (var k in subresults[subFrameName].children) {
						result[subFrameName].children[k] = result[subFrameName].children[k] || {};
						result[subFrameName].children[k].calls = (result[subFrameName].children[k].calls || 0);
					  result[subFrameName].children[k].calls += subresults[subFrameName].children[k].calls;
					  result[subFrameName].children[k].selfTime = result[subFrameName].children[k].selfTime || 0;
					  result[subFrameName].children[k].selfTime += subresults[subFrameName].children[k].selfTime;
					  result[subFrameName].children[k].childrenSyncTime = result[subFrameName].children[k].childrenSyncTime || 0;
					  result[subFrameName].children[k].childrenSyncTime += subresults[subFrameName].children[k].childrenSyncTime;
					  result[subFrameName].children[k].childrenAsyncTime = result[subFrameName].children[k].childrenAsyncTime || 0;
					  result[subFrameName].children[k].childrenAsyncTime += subresults[subFrameName].children[k].childrenAsyncTime;
					}
				});
			});
		}

		return result;
	};

	var result = accumulate(null, callgraph);
	var sortedKeys = Object.keys(result).filter(function (k) {
		return k !== 'null';
	}).sort(function (key1, key2) {
		return result[key2].totalTime - result[key1].totalTime;
	});
	return sortedKeys.map(function (k) {
		return {frameName: k, data: result[k]};
	});
};
