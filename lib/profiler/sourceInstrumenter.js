/**
 * yprof source code instrumenter.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var path = require('path');
var falafel = require('falafel');
var acornTools = require('./acorn_tools.js');

var opt = {};

module.exports = function instrument (commander, state, filename, source, sourceHash) {
  var gs = commander.globalVarname;
  var an = gs+'an';
  var cwd = process.cwd();

  // To alleviate memory pressure in user code, we just send sourceDict entries
  //  to the server and forget about them.
  // Because we must enable source caching, we put all the source writing in the
  //  compiled source itself.
  var sourceDictObject = {};
  var setSourceDict = function (i, obj) {
    sourceDictObject[i] = obj;
  };

  // The ID is an integer if we're not caching source, and a string otherwise -
  //  we prepend the hash to the ID to make sure that sourceDict entries never
  //  collide.
  var localLastInstId = 0;
  var getUniqueId = function () {
    return (sourceHash ? sourceHash + ':' + localLastInstId++ : state.lastInstId++);
  };

  // Update a node, ensuring that if this id has been disabled, the source
  //  transform is skipped.
  var updateNode = function (node, id, update) {
    if (commander.disableInstrumentation.indexOf(id) === -1) {
      node.update(update);
    }
  };

  var getFnName = function (node) {
    if (node && node.id && node.id.name) {
      return node.id.name + '';
    }

    var name;
    if (node && node.parent) {
      //console.log(node.parent);
      //console.log(node.parent.type, node.parent.parent.type, node.parent.parent.parent.type);
    }
		acornTools.walkUp(node.parent, {
      Property:            function(n, p){ return name = acornTools.stringify(n) },
			VariableDeclarator:  function(n, p){ return name = acornTools.stringify(n.id) },
			AssignmentExpression:function(n, p){ return name = acornTools.stringify(n.left) },
			ObjectExpression:    function(n, p){ return name = acornTools.stringify(p.key) },
			CallExpression:      function(n, p){
				var id = '' // use deepest id as name
				acornTools.walkDown(n.callee, {Identifier: function(n){id = n.name}})
				if(id == 'bind') return
				return name = (n.callee.type == 'FunctionExpression'? getFnName(n.parent) || '' : id) + ' ->'
			}
		});

    return name;
  };

  var wrapExpr = function (node) {
    var src = node.source();
    if (src.indexOf('('+gs+'.pc(') !== 0) {
      var id = getUniqueId();
      updateNode(node, id, '('+gs+'.pc('+JSON.stringify(id)+','+an+'),'+src+')');
      setSourceDict(id, {x: node.loc.start.column, y:node.loc.start.line});
    }
  };

  // For function start/end
  var wrapFn = function (node) {
    var fnid = getUniqueId();
    var tryEndId = getUniqueId();
    var footId = getUniqueId();

    var isRoot = node.type === 'Program';

    var sx = (node.body.loc || node.loc).start.column;
    var sy = (node.body.loc || node.loc).start.line;
    var ex = (node.body.loc || node.loc).end.column;
    var ey = (node.body.loc || node.loc).end.line;

    // Get name of function/program
    var name = (getFnName(node) || (isRoot  ? 'Object.<anonymous>' : '<anonymous>')) +
      ' (' + filename.replace(cwd, '') + ':' + sy + ':' + sx + ')';

    // All sourceDict entries must be in before programHead() is called below.
    setSourceDict(fnid, { x: sx, y: sy, sx: sx, sy: sy, ex: ex, ey: ey, root: isRoot, name: name });
    setSourceDict(tryEndId, { x: ex, y: ey, ret:fnid });
    setSourceDict(footId, { x: ex, y: ey, ret:fnid });

    var programHead = function () {
      return 'var '+an+'={fnid:'+JSON.stringify(fnid)+'},' +
        gs+'=require("'+path.join(__dirname, 'localInstrumentationReceiver.js')+'");' +
        gs+'.s('+JSON.stringify(sourceDictObject)+');' +
        gs+'.f('+an+');';
    };
    var fnHead = 'var '+an+'={fnid:'+JSON.stringify(fnid)+'};'+gs+'.f('+an+');';
  	var tryStart = 'try{';
  	var tryEnd = '}catch(x){'+gs+'.e('+gs+'.pc(' + JSON.stringify(tryEndId) + ','+an+'),'+an+');throw x}';

    var head = (isRoot ? programHead() : fnHead);
    var foot = ';'+gs+'.e('+gs+'.pc('+JSON.stringify(footId)+','+an+'),'+an+')';

    var nodeFnStart, nodeFnEnd, nodeInternal;
    var src = node.source();
    if (isRoot) {
      nodeFnEnd = nodeFnStart = '';
      nodeInternal = src;
    } else {
      var firstBracket = src.indexOf('{');
      var lastBracket = src.lastIndexOf('}');
      nodeFnStart = src.slice(0, firstBracket + 1);
      nodeFnEnd = src.slice(lastBracket, lastBracket + 1);
      nodeInternal = src.slice(firstBracket + 1, lastBracket);
    }

    updateNode(node, fnid, nodeFnStart + head + tryStart + nodeInternal + foot + tryEnd + nodeFnEnd);
  };

  var hashbang = '';
  if (source[0] === '#') {
    var sourceLines = source.split('\n');
    hashbang = sourceLines.splice(0);
    source = sourceLines.join('\n');
  }

  var output = falafel(source, { locations: 1 }, function (node) {
    switch (node.type) {
      case 'ReturnStatement':
        var id = getUniqueId();

        if (node.argument) {
          updateNode(node.argument, id, '('+gs+'.e('+gs+'.pc('+JSON.stringify(id)+','+an+'),'+an+',('+node.argument.source()+')))');
        } else {
          updateNode(node, id, 'return ('+gs+'.e('+gs+'.pc('+JSON.stringify(id)+','+an+'),'+an+'));');
        }

        setSourceDict(id, {x: node.loc.start.column, y:node.loc.start.line, r:1});
        break;
      case 'AssignmentExpression':
        wrapExpr(node);
        break;
      case 'CallExpression':
        wrapExpr(node);
        break;
      case 'MemberExpression':
        // If the parent type is CallExpression, do not wrap this node!
        //
        // Allow me to explain:
        // > function F () {}
        // > F.prototype.foo = function () { return typeof this.foo; }
        // > var bar = new F();
        // > bar.foo();     // >> "function". expected. okay.
        // > (bar.foo)();   // >> "function". expected. okay.
        // > (1,bar.foo)(); // >> "undefined". NOT expected. wat.
        // Since the CallExpression will wrap it, anyway, we're fine: both the call
        // and the get() function (if any) will be annotated.
        if (node.parent && ['CallExpression', 'AssignmentExpression'].indexOf(node.parent.type) !== -1) {
          break;
        }
        // obj.member++
        if (node.parent && node.parent.type === 'UpdateExpression') {
          wrapExpr(node.parent);
          break;
        }

        wrapExpr(node);
        break;
      case 'FunctionDeclaration':
        wrapFn(node);
        break;
      case 'FunctionExpression':
        wrapFn(node);
        break;
      case 'Program':
        wrapFn(node);
        break;
    }
  }).toString();

  return hashbang+output;
};
