$(function () {
  'use strict';

  var accumulateCallTimes = require('../../../callgraph/accumulateCallTimes');
  var collapseCallGraph = require('../../../callgraph/collapse');

  var data = {};
  var commander = {};
  var templateSource = $('#template').remove().html().replace(/^\s*/, '').replace(/\s*$/, '');
  var rootNode, oldTree;

  var h = require('virtual-dom/h');
  var diff = require('virtual-dom/diff');
  var patch = require('virtual-dom/patch');
  var createElement = require('virtual-dom/create-element');
  var html2hscript = require('html2hscript');
  var HandlebarsFormHelpers = require('handlebars-form-helpers');

  var deepClone = function (o) {
    return JSON.parse(JSON.stringify(o));
  }

  function recompileRawData () {
    data = deepClone(window.__rawTraceData);
		data.callgraph = accumulateCallTimes(data.callgraph);
		data.callgraph = collapseCallGraph(commander, data.callgraph);
  }

  function formatTabs () {
    var rawCallgraph = deepClone(data.callgraph);
    if (commander.hideCallRecords) {
      rawCallgraph = hideCallRecords(rawCallgraph);
    }

    var context = {
      // Form values
      collapseModuleLoadFrames: commander.collapseModuleLoadFrames,
      collapsekFrameText: commander.collapseFrame.join('\n'),
      hideCallRecords: commander.hideCallRecords,

      // Display
      elapsedTimeTotal: data.elapsedTimeTotal,
      rawSourceDict: JSON.stringify(data.sourceDict, null, 2),
      rawFlatCalls: JSON.stringify(data.flatcalls, null, 2),
      rawCallGraph: JSON.stringify(rawCallgraph, null, 2)
    };

    // Construct HTML dom element
    var html = Handlebars.compile(templateSource)(context);

    html2hscript(html, function (err, hscript) {
      if (err) {
        console.log(err);
        $('body').html(html);
        return setupPageEvents();
      }

      // remove trailing / leading whitespace
      hscript = hscript.replace(/^\s*(\"[\\n\s]*\",\s*)/, '').replace(/(, \s*\"[\\n\s]*\")$/, '');

      var tree = eval(hscript);
      if (!rootNode) {
        rootNode = createElement(tree);
        document.body.appendChild(rootNode);
      } else {
        var patches = diff(oldTree, tree);
        rootNode = patch(rootNode, patches);
      }
      oldTree = tree;

      return setupPageEvents();
    });
  }

  function setupPageEvents () {
    $('#collapseModuleLoadFrames').off().on('change', function () {
      commander.collapseModuleLoadFrames = this.checked;
      recompileRawData();
      formatTabs();
    });

    $('#collapseFrame').off().on('change', function () {
      commander.collapseFrame = $(this).val().split('\n');
      recompileRawData();
      formatTabs();
    });

    $('#hideCallRecords').off().on('change', function () {
      commander.hideCallRecords = this.checked;
      recompileRawData();
      formatTabs();
    });

    $('#tabs').tabs();
  }

  function initPage () {
    commander.hideCallRecords = true;
    recompileRawData();
    formatTabs();
  }

  function hideCallRecords (callgraph) {
    delete callgraph.callRecords;

    if (callgraph.subcalls) {
      Object.keys(callgraph.subcalls).map(function (frame) {
        callgraph.subcalls[frame] = hideCallRecords(callgraph.subcalls[frame]);
      });
    }

    return callgraph;
  }

  HandlebarsFormHelpers.register(Handlebars)

  commander = deepClone(window.__defaultCommanderOptions);
  initPage();
});
