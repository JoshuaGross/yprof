/**
 * Display any process-blocking sync blocks of code.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var table = require('text-table');

module.exports = function (data) {
	var callgraph = data.callgraph;

  // Flatten `maxSyncTime` records in callgraph
  var flattenCallgraph = function (frame, callgraph) {
    var rec = {
      frame: frame,
      fnid: callgraph.fnid,
      maxSyncTime: callgraph.maxSyncTime,
      avgSyncTime: callgraph.avgSyncTime,
      calls: callgraph.calls,
      totalSyncTime: callgraph.callTimesTotal
    };
    return Array.prototype.concat.apply([rec], Object.keys(callgraph.subcalls || []).map(function (frame) {
      return flattenCallgraph(frame, callgraph.subcalls[frame]);
    }));
  };

  var syncCallTimes = flattenCallgraph(null, callgraph).filter(function (o) {
    return o.frame !== null && o.fnid !== -1 && o.maxSyncTime !== 0;
  }).sort(function (a, b) {
    return b.totalSyncTime - a.totalSyncTime;
  });

  var header = [
    ['        ', '                  ', '                  ', '       ', '                        '],
    ['Function', 'Max sync time (ms)', 'Avg sync time (ms)', '# Calls', 'Total time (accumulated)'],
  ];
  var footer = [
    ['        ', '                  ', '                  ', '       ', '                        ']
  ];

  return table(header.concat(syncCallTimes.map(function (rec) {
    return [
      rec.frame,
      rec.maxSyncTime.toPrecision(4),
      rec.avgSyncTime.toPrecision(4),
      rec.calls,
      rec.totalSyncTime.toPrecision(4)
    ];
  })).concat(footer));

	return JSON.stringify(syncCallTimes, null, 2);
};
