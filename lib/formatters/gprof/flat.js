/**
 * gprof flat profile format:
 * https://sourceware.org/binutils/docs/gprof/Flat-Profile.html#Flat-Profile
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var table = require('text-table');

module.exports = function (data) {
	var flatcalls = data.flatcalls;
	var sourceDict = data.sourceDict;

  flatcalls = Object.keys(flatcalls).map(function (i) {
    return flatcalls[i];
  }).sort(function (a, b) {
    return b.callTimesTotal - a.callTimesTotal;
  });

  var totalTime = flatcalls.reduce(function (prev, curr) {
    return prev+curr.callTimesTotal;
  }, 0);

  // Get data for each record:
  // name of function / file
  // pct (of time / totalTime)
  // cumulative time spent
  // milliseconds per call (self)
  // milliseconds per call (self + descendents) - need call graph analysis
  var accumTime = 0;
  for (var i in flatcalls) {
    var record = flatcalls[i];
    record.name = sourceDict[record.i].name;
    record.pct = record.callTimesTotal / totalTime * 100;
    record.cumulative = accumTime = (accumTime + record.callTimesTotal);
    record.msPerCallSelf = record.callTimesTotal / record.calls;
    record.msPerCallCumulative = 0; //
  }

  // Create and format table
  var header = [
    ['     ', '             ', '       ', '     ', '       ', '       ', '    '],
    ['gprof', 'Flat profile:', '       ', '     ', '       ', '       ', '    '],
    ['     ', '             ', '       ', '     ', '       ', '       ', '    '],
    [' %   ', 'cumulative   ', ' self  ', '     ', ' self  ', ' total ', '    '],
    ['time ', '  seconds    ', 'seconds', 'calls', 'ms/call', 'ms/call', 'name']
  ];
  var footer = [
    ['    ', '          ', '       ', '     ', '       ', '       ', '    ']
  ];
  return table(header.concat(flatcalls.map(function (record) {
    return [
      parseFloat(record.pct.toPrecision(4)),
      parseFloat((record.cumulative / 1000).toPrecision(2)),
      parseFloat((record.callTimesTotal / 1000).toPrecision(2)),
      record.calls,
      parseFloat(record.msPerCallSelf.toPrecision(2)),
      parseFloat(record.msPerCallCumulative.toPrecision(2)),
      record.name.replace(__dirname, "")
    ];
  })).concat(footer), { align: ['r', 'r', 'r', 'r', 'r', 'r', 'l'] });
};
