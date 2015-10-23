/**
 * Output a (Graphviz) dot graph.
 * This is useful for visualizing very small workflows - it becomes unwieldy very quickly!
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

module.exports = function (data) {
	var callgraph = data.callgraph;
	var flatcalls = data.flatcalls;

  // from flat.js, to get totalTime
  flatcalls = Object.keys(flatcalls).map(function (i) {
    return flatcalls[i];
  }).sort(function (a, b) {
    return b.callTimesTotal - a.callTimesTotal;
  });
  var totalTime = flatcalls.reduce(function (prev, curr) {
    return prev+curr.callTimesTotal;
  }, 0);

  // Edges: edges[source][sink] = { syncTime }
  var nodes = {};
  var edges = {};

  var accumulateCallGraph = function (frame, callgraph) {
    if (frame) {
      nodes[frame] = nodes[frame] || {};
      nodes[frame].syncTime = nodes[frame].syncTime || 0;
      nodes[frame].syncTime += callgraph.callTimesTotal;
    }

    Object.keys(callgraph.subcalls || []).map(function (childFrame) {
      if (frame) {
        edges[frame] = edges[frame] || {};
        edges[frame][childFrame] = {};

				var fullyAsync = childFrame.indexOf('<async>') !== -1;
				var partialAsync = !fullyAsync && (callgraph.subcalls[childFrame].asyncCalls || 0) !== 0;
				edges[frame][childFrame].lineStyle = (fullyAsync ? 'dashed' : (partialAsync ? 'dotted' : 'solid'));
      }
      accumulateCallGraph(childFrame, callgraph.subcalls[childFrame]);
    });
  };

  var drawNodes = function () {
    var res = '';

    Object.keys(nodes).map(function (frame) {
      var pctTime = parseFloat(nodes[frame].syncTime / totalTime * 100).toPrecision(2);
      var label = frame + '\n' + pctTime + '%';
      res += '    ' + JSON.stringify(frame) + ' [label=' + JSON.stringify(label) + ']' + ';\n';
    });

    return res;
  };

  var drawEdges = function () {
    var res = '';

    Object.keys(edges).map(function (source) {
      Object.keys(edges[source]).map(function (sink) {
				var edge = edges[source][sink];
        var style = ' [style="' + edge.lineStyle +'"]';
        res += '    ' + JSON.stringify(source) + ' -> ' + JSON.stringify(sink) + style + ';\n';
      });
    });

    return res;
  };

  accumulateCallGraph(null, callgraph);

  return 'digraph ' + JSON.stringify(data.args.join(' ')) + ' {\n'
    + drawNodes()
    + drawEdges()
    + '}';
};
