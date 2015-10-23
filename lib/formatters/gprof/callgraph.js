/**
 * gprof call graph format:
 * https://sourceware.org/binutils/docs/gprof/Call-Graph.html#Call-Graph
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var table = require('text-table');
var subcallAccumulator = require('../../callgraph/accumulateSubcalls');

module.exports = function (data) {
	var elapsedTime = data.elapsedTimeTotal;
	var callgraph = data.callgraph;

	// Prune call graph so it's not deeply nested with:
	// module -> require -> module -> require etc
	prev = callgraph;
	while (callgraph && !callgraph.calls && callgraph.subcalls && Object.keys(callgraph.subcalls).length == 1) {
		prev = callgraph.subcalls;
		callgraph = callgraph.subcalls[Object.keys(callgraph.subcalls)[0]];
	}
	if (prev !== callgraph) {
		callgraph = { subcalls: prev };
	}

	var subcalls = subcallAccumulator(callgraph);
	var tableRows = [];

	var indexMax = 0;
	subcalls = subcalls.map(function (subcall) {
		subcall.parentCallsTotal = Object.keys(subcall.data.parents).reduce(function (prev, curr) {
			return prev + (subcall.data.parents[curr].calls || 0);
		}, 0);
		subcall.childCallsTotal = Object.keys(subcall.data.children).reduce(function (prev, curr) {
			return prev + (subcall.data.children[curr].calls || 0);
		}, 0);

		subcall.index = ++indexMax;

		return subcall;
	}).filter(function (subcall) {
		return !!subcall;
	});

	subcalls.map(function (subcall) {
		var parentCallsTotal = subcall.parentCallsTotal;
		var childCallsTotal = subcall.childCallsTotal;

		if (subcall.frameName === 'null') {
			return;
		}

		Object.keys(subcall.data.parents).map(function (parentName) {
			var index = (subcalls[parentName] && subcalls[parentName].index && ' [' + subcalls[parentName].index + ']') || '';
			var name = parentName;

			if (name === 'null') {
				return;
			}

			tableRows.push([
				' ',
				' ',
				parseFloat(subcall.data.selfTime.toPrecision(4)),
				parseFloat(subcall.data.childrenSyncTime.toPrecision(4)),
				(subcall.data.parents[parentName].calls || 0) + '/' + parentCallsTotal,
				'    ' + name + index
			]);
		});

		tableRows.push([
			'[' + subcall.index + ']',
			parseFloat((subcall.data.selfTime / elapsedTime * 100).toPrecision(4)) + '%',
			parseFloat(subcall.data.selfTime.toPrecision(4)),
			parseFloat(subcall.data.childrenSyncTime.toPrecision(4)),
			subcall.data.calls || 0,
			subcall.frameName + ' [' + subcall.index + ']'
		]);

		Object.keys(subcall.data.children).map(function (childName) {
			var index = (subcalls[childName] && subcalls[childName].index && ' [' + subcalls[childName].index + ']') || '';
			var name = childName;

			if (name === 'null') {
				return;
			}

			tableRows.push([
				' ',
				' ',
				parseFloat(subcall.data.children[childName].selfTime.toPrecision(4)),
				parseFloat(subcall.data.children[childName].childrenSyncTime.toPrecision(4)),
				(subcall.data.children[childName].calls || 0) + '/' + childCallsTotal,
				'    ' + name + index
			]);
		});

		tableRows.push([
			'------',
			'------',
			'------',
			'------',
			'------',
			'------'
		]);
	});

	var head = [
    ['     ', '      ', '     ', '        ', '      ', '    '],
    ['gprof', ' Call-', 'graph', 'profile:', '      ', '    '],
    ['     ', '      ', '     ', '        ', '      ', '    '],
		['index', '% time', 'self ', 'children', 'called', 'name'],
    ['     ', '      ', '     ', '        ', '      ', '    ']
	];
	var formattedTable = table(head.concat(tableRows), { align: ['l', 'l', 'l', 'l', 'l', 'l'] });
  return formattedTable.replace(/\n[\-\s]+(\n|$)/g, "\n-----------------------------------------------$1");
};
