/**
 * Test callgraph manipulations:
 *
 * a -> b <async> -> c
 * a -> c
 *
 * If `b <async>` is collapsed, we should have a -> c <async> and a -> c.
 *
 * @copyright (c) 2015, Yahoo Inc. Code licensed under the MIT license. See LICENSE file for terms.
 */

var exec = require('child_process').exec;
var path = require('path');
var assert = require('assert');
var spawn = require('child_process').spawn;
function execute(command, callback){
  exec(command, { maxBuffer: Infinity }, function(error, stdout, stderr) {
    callback(stdout);
  });
};

var profiler = path.join(__dirname, '../yprof.js');

describe('callgraph collapser', function () {
  var collapse = require('../lib/callgraph/collapse');

  // a->b, a->c, collapse a
  it('should collapse graph 1', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            b: {
              calls: 1
            },
            c: {
              calls: 2
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: [] }, callgraph);

    assert.equal(collapsed.subcalls['a'].subcalls['b'].calls, 1);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].calls, 2);

    var collapsed2 = collapse({ collapseFrame: ['a'] }, callgraph);

    assert.equal(collapsed2.subcalls['b'].calls, 1);
    assert.equal(collapsed2.subcalls['c'].calls, 2);
  });

  // a->b, a->c, collapse a, make sure asyncCalls are preserved in b and c
  it('should collapse graph 2', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            b: {
              calls: 1,
              asyncCalls: 3
            },
            c: {
              calls: 2,
              asyncCalls: 4
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['a'] }, callgraph);

    assert.equal(collapsed.subcalls['b'].calls, 1);
    assert.equal(collapsed.subcalls['b'].asyncCalls, 3);
    assert.equal(collapsed.subcalls['c'].calls, 2);
    assert.equal(collapsed.subcalls['c'].asyncCalls, 4);
  });

  // a->b->c, a->c, collapse b. b NOT async.
  it('should collapse graph 3', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            b: {
              calls: 11,
              subcalls: {
                c: {
                  calls: 5,
                  asyncCalls: 6
                }
              }
            },
            c: {
              calls: 2,
              asyncCalls: 4
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['b'] }, callgraph);
    assert.equal(collapsed.subcalls['a'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].asyncCalls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].calls, 7);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].asyncCalls, 10);
  });

  // a->b->c->d, a->d, collapse b. b IS async, children all sync
  it('should collapse graph 4', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            'b <async>': {
              subcalls: {
                c: {
                  calls: 7,
                  subcalls: {
                    d: {
                      calls: 3,
                      asyncCalls: 4
                    }
                  }
                }
              }
            },
            d: {
              calls: 5,
              asyncCalls: 6
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['b <async>'] }, callgraph);
    assert.equal(collapsed.subcalls['a'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].asyncCalls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].asyncCalls, 7);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].subcalls['d'].calls, 3);
    assert.equal(collapsed.subcalls['a'].subcalls['c'].subcalls['d'].asyncCalls, 4);
    assert.equal(collapsed.subcalls['a'].subcalls['d'].calls, 5);
    assert.equal(collapsed.subcalls['a'].subcalls['d'].asyncCalls, 6);
  });

  // a->b->c->d, a->d, collapse b, c. b IS async, children all sync
  it('should collapse graph 5', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            'b <async>': {
              subcalls: {
                c: {
                  calls: 7,
                  subcalls: {
                    d: {
                      calls: 3,
                      asyncCalls: 4
                    }
                  }
                }
              }
            },
            d: {
              calls: 5,
              asyncCalls: 6
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['b <async>', 'c'] }, callgraph);
    assert.equal(collapsed.subcalls['a'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].asyncCalls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['d'].calls, 5);
    assert.equal(collapsed.subcalls['a'].subcalls['d'].asyncCalls, 13);
  });

  // a->b->c->d->e, a->d->e, collapse b, c, d. b IS async, d becomes sync/async by collapse,
  //  e should be collapsed partially sync and partially async (5/12)
  it('should collapse graph 6', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            'b <async>': {
              subcalls: {
                c: {
                  calls: 7,
                  subcalls: {
                    d: {
                      calls: 3,
                      asyncCalls: 4,
                      subcalls: {
                        e: {
                          calls: 7 // this is all on a collapsed async path, so this becomes 7 async
                        }
                      }
                    }
                  }
                }
              }
            },
            d: {
              calls: 5,
              asyncCalls: 6,
              subcalls: {
                e: {
                  calls: 11 // 6 async and 5 sync from parent
                }
              }
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['b <async>', 'c', 'd'] }, callgraph);
    assert.equal(collapsed.subcalls['a'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].asyncCalls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['e'].calls, 5);
    assert.equal(collapsed.subcalls['a'].subcalls['e'].asyncCalls, 13);
  });

  // a->b->c->d->e, a->d->e, collapse b, c, d. b IS async, d IS async,
  //  e should be collapsed partially sync and partially async
  it('should collapse graph 7', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            'b <async>': {
              subcalls: {
                c: {
                  calls: 7,
                  subcalls: {
                    'd <async>': {
                      subcalls: {
                        e: {
                          calls: 7 // this is all on a collapsed async path, so this becomes 7 async
                        }
                      }
                    }
                  }
                }
              }
            },
            'd <async>': {
              calls: 5,
              asyncCalls: 6,
              subcalls: {
                e: {
                  calls: 11 // 6 async and 5 sync from parent
                }
              }
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['b <async>', 'c', 'd <async>'] }, callgraph);
    assert.equal(collapsed.subcalls['a'].calls, undefined);
    assert.equal(collapsed.subcalls['a'].asyncCalls, undefined);
    assert.equal(collapsed.subcalls['a'].subcalls['e'].asyncCalls, 18);
  });

  // a -> b -> c -> d, collapse a. Information should be preserved for b->c->d.
  it('should collapse graph 8', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            b: {
              calls: 1,
              asyncCalls: 1,
              subcalls: {
                c: {
                  calls: 1,
                  asyncCalls: 1,
                  subcalls: {
                    d: {
                      calls: 1,
                      asyncCalls: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['a'] }, callgraph);
    assert.equal(collapsed.subcalls['b'].calls, 1);
    assert.equal(collapsed.subcalls['b'].asyncCalls, 1);
    assert.equal(collapsed.subcalls['b'].subcalls['c'].calls, 1);
    assert.equal(collapsed.subcalls['b'].subcalls['c'].asyncCalls, 1);
    assert.equal(collapsed.subcalls['b'].subcalls['c'].subcalls['d'].calls, 1);
    assert.equal(collapsed.subcalls['b'].subcalls['c'].subcalls['d'].asyncCalls, 1);
  });

  // a -> b -> c -> d, collapse a,b. Information should be preserved for c->d.
  it('should collapse graph 9', function () {
    var callgraph = {
      subcalls: {
        a: {
          subcalls: {
            b: {
              calls: 1,
              asyncCalls: 1,
              subcalls: {
                c: {
                  calls: 1,
                  asyncCalls: 1,
                  subcalls: {
                    d: {
                      calls: 1,
                      asyncCalls: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    var collapsed = collapse({ collapseFrame: ['a', 'b'] }, callgraph);
    assert.equal(collapsed.subcalls['c'].calls, 1);
    assert.equal(collapsed.subcalls['c'].asyncCalls, 1);
    assert.equal(collapsed.subcalls['c'].subcalls['d'].calls, 1);
    assert.equal(collapsed.subcalls['c'].subcalls['d'].asyncCalls, 1);
  });
});

describe('callgraph tests', function () {
  it('should produce mixed sync/async code callgraphs', function (done) {
    execute(profiler + ' --format=raw-callgraph --collapse-module-load-frames test/examples/mixed-sync-async.js 1', function (output) {
      var callgraph = JSON.parse(output);

      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].subcalls['c (/test/examples/mixed-sync-async.js:10:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>'].calls, undefined);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].subcalls['c (/test/examples/mixed-sync-async.js:10:14)'].calls, 1);

      done();
    });
  });

  it('should collapse mixed sync/async code callgraphs, distinguish between sync and async frames', function (done) {
    execute(profiler + ' --format=raw-callgraph --collapse-frame="Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>" test/examples/mixed-sync-async.js 1', function (output) {
      var wholeCallgraph = JSON.parse(output);
      var callgraph = wholeCallgraph.subcalls["Module.require (module.js:364:17)"].subcalls["Function.Module._load (module.js:312:12)"].subcalls["Module.load (module.js:356:32)"].subcalls["Module._compile (module.js:456:26)"];

      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].asyncCalls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].subcalls['c (/test/examples/mixed-sync-async.js:10:14)'].calls, 2);

      done();
    });
  });

  it('should collapse mixed sync/async code callgraphs AND module load frames, distinguish between sync and async frames', function (done) {
    execute(profiler + ' --format=raw-callgraph --collapse-module-load-frames --collapse-frame="Timer.listOnTimeout [as ontimeout] (timers.js:112:15) <async>" test/examples/mixed-sync-async.js 1', function (output) {
      var callgraph = JSON.parse(output);

      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].asyncCalls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].subcalls['c (/test/examples/mixed-sync-async.js:10:14)'].calls, 1);
      assert.equal(callgraph.subcalls['Object.<anonymous> (/test/examples/mixed-sync-async.js:1:0)'].subcalls['a (/test/examples/mixed-sync-async.js:1:14)'].subcalls['b (/test/examples/mixed-sync-async.js:6:14)'].subcalls['c (/test/examples/mixed-sync-async.js:10:14)'].asyncCalls, 1);

      done();
    });
  });
});
