# yprof
`yprof` is a CPU time profiler for Node.js. This is meant to be a simple tool to collect run-time data about your applications.
yprof is meant to be accessible, making performance profiling accessible to anyone - the power of flamegraphs but without the complexity.
The hope is that yprof becomes useful for debugging slow code (or hot codepaths), and as a QA tool as part of build processes to prevent performance regression.

# Install
```
git clone git@github.com:joshuagross/yprof.git
cd yprof
npm link yprof
```

# Getting started
You can run any code with `yprof`. Instead of running `node server.js --my-args`, just run `yprof server.js --my-args`. Once the script is done executing (or once you kill it with `Ctrl-C`),
yprof will display profiling data.

Start by cloning yprof:

```
   $ git clone git@github.com:joshuagross/yprof.git
   $ cd yprof
```

Let's start by running one of the examples included with yprof:

```
   $ ./profiler.js --format=raw-callgraph test/examples/async-fs.js
```

The current formatting options available are `raw-callgraph`, `gprof-flat`, and `gprof-callgraph`.

```
	{
	  "subcalls": {
		"Module.require (module.js:364:17)": {
		  "fnid": -1,
		  "subcalls": {
			"Function.Module._load (module.js:312:12)": {
			  "fnid": -1,
			  "subcalls": {
				"Module.load (module.js:356:32)": {
				  "fnid": -1,
				  "subcalls": {
					"Module._compile (module.js:456:26)": {
					  "fnid": -1,
					  "subcalls": {
						"Object.<anonymous> (/test/examples/async-fs.js:1:158)": {
						  "fnid": 0,
						  "calls": 1,
						  "callTimesTotal": 250.65570799999998,
						  "subcalls": {
							"Timer.listOnTimeout [as ontimeout] (timers.js:112:15)": {
							  "fnid": -1,
							  "subcalls": {
								"a (/test/examples/async-fs.js:4:41)": {
								  "fnid": 5,
								  "calls": 1000,
								  "callTimesTotal": 555.5670640000014,
								  "subcalls": {
	<snip>
```

This is interesting, but there's a lot of data in here we're not really interested in. Let's tell `yprof` to remove some of the extraneous stack frames. First, let's get rid of all the
Node.js internal Module loading stack frames:

```
   $ ./profiler.js --format=raw-callgraph --collapse-module-load-frames test/examples/async-fs.js
```

The result:
```
	{
	  "subcalls": {
		"Object.<anonymous> (/test/examples/async-fs.js:1:158)": {
		  "fnid": 0,
		  "calls": 1,
		  "callTimesTotal": 246.085286,
		  "subcalls": {
			"Timer.listOnTimeout [as ontimeout] (timers.js:112:15)": {
			  "fnid": -1,
			  "subcalls": {
				"a (/test/examples/async-fs.js:4:41)": {
				  "fnid": 5,
				  "calls": 1000,
				  "callTimesTotal": 590.4374009999972,
				  "subcalls": {
					"Object.oncomplete (fs.js:108:15)": {
					  "fnid": -1,
					  "subcalls": {
						"/test/examples/async-fs.js:5:130": {
						  "fnid": 8,
						  "calls": 1000,
						  "callTimesTotal": 624.7881000000023,
						  "subcalls": {
							"Timer.listOnTimeout [as ontimeout] (timers.js:112:15)": {
							  "fnid": -1,
							  "subcalls": {
								"null.<anonymous> (/test/examples/async-fs.js:7:77)": {
								  "fnid": 11,
								  "calls": 1000,
								  "callTimesTotal": 1092.8941929999974,
								  "subcalls": {
									"displayStats (/test/examples/async-fs.js:14:59)": {
									  "fnid": 17,
									  "calls": 1000,
									  "callTimesTotal": 4.220314999996845,
									  "subcalls": {}
									}
								  }
								}
							  }
							}
						  }
						}
					  }
					}
				  }
				}
			  }
			}
		  }
		}
	  }
```

Finally, let's get rid of the `Object.oncomplete` and `Timer.listOnTimeout` stack frames. This is also straightforward:

```
   $ ./profiler.js --format=raw-callgraph --collapse-module-load-frames --collapse-frame="Timer.listOnTimeout [as ontimeout] (timers.js:112:15)" --collapse-frame="Object.oncomplete (fs.js:108:15)" test/examples/async-fs.js
```

The result:

```
	{
	  "subcalls": {
		"Object.<anonymous> (/test/examples/async-fs.js:1:158)": {
		  "fnid": 0,
		  "calls": 1,
		  "callTimesTotal": 244.233627,
		  "subcalls": {
			"a (/test/examples/async-fs.js:4:41)": {
			  "fnid": 5,
			  "calls": 1000,
			  "callTimesTotal": 539.7169200000037,
			  "subcalls": {
				"/test/examples/async-fs.js:5:130": {
				  "fnid": 8,
				  "calls": 1000,
				  "callTimesTotal": 590.825508999993,
				  "subcalls": {
					"null.<anonymous> (/test/examples/async-fs.js:7:77)": {
					  "fnid": 11,
					  "calls": 1000,
					  "callTimesTotal": 1068.6106220000047,
					  "subcalls": {
						"displayStats (/test/examples/async-fs.js:14:59)": {
						  "fnid": 17,
						  "calls": 1000,
						  "callTimesTotal": 3.9054989999999634,
						  "subcalls": {}
						}
					  }
					}
				  }
				}
			  }
			}
		  }
		}
	  }
	}
```

Once you're happy with the data that's being produced, we can visualize the data in more helpful ways. Try `--format=gprof-flat`, `--format=gprof-callgraph`, and `--format=yprof-sync-bottlenecks`.

Give it a spin - run your own code with yprof!

# Advanced Usage
## Compiling source
In case you want to generate instrumented source at build time, there is a `yprof-compile`
command available:

`yprof-compile --cache-dir=./yprof-cache/`

This will compile all sources matching the pattern `**/*.js` in the current directory.

## Running from a cache
You can cache instrumented source to make startup/require time faster after the first run,
and also to enable easier code auditing and debugging:

`yprof --cacheDir=./yprof-cache/ server.js`

`yprof` caches code based on the hashed source, /not/ based on the filename. This is
because we often compile our source into instrumented source and then run it on a different
machine where paths won't be consistent.

```
$ ls ./yprof-cache/
10fe9221.js 1bd0234b.js 26259166.js 2d6fb259.js 3f07d46d.js 51dc545e.js 61118cee.js 6f24ed3a.js 7dc1cc6c.js 87b0453d.js 8d86f87d.js 9f3560db.js ae9c20e.js  bf086086.js d3e4bffc.js e80c2773.js ffcbf234.js
...
```

To display the instrumented source for a particular file, with line numbers, use `yprof-hash`:
```
$ cat -n ./yprof-cache/`yprof-hash server.js`.js
1 line 1
2 line 2
...
```

To only run code that has been cached (compiled), use the `--cache-only` flag.
This guarantees that anything running in node.js is already on the disk, and helps
with code auditing.

`yprof --cacheDir=./yprof-cache/ --cache-only server.js`

## Turning off particular instrumentations
This is useful if you are debugging `yprof` itself. You can turn off particular
instrumentations (keep in mind that if you change code at all, these IDs will change;
and you will need to delete cached code for this option to take effect). The most
stable way to ensure that disabled instrumentations stay disabled is to not hardcode
the hash, and to use `yprof-hash`. For example, if you want to disable instrumentations
`20` through `40` in server.js, which has a hash `abcdefg`, don't hardcode the
hash `abcdefg` but use `yprof-hash server.js` since the hash changes whenever server.js
changes:

```
  yprof --disable-i=`yprof-hash server.js`:20-`yprof-hash server.js`:40 server.js
```

This will remain stable as long as server.js isn't changed enough to shuffle around
source indexes 20 through 40.

# How it works
`yprof` transforms your JavaScript on-the-fly (**), injecting instrumentation calls through your code to
log everything that happens while your code is running. On a separate process, this data is
compiled and returned to you in one of several formats that you can choose. It is also possible
to output raw trace data and format it later.

(**) It is also possible to "compile" instrumented code ahead of time.

# LICENSE
yprof is released under the MIT license. Note that parts of the codebase were inspired by [TraceGL](https://github.com/traceglMPL/tracegl), released under the MPL 2.0 license. In particular, `lib/profiler/sourceInstrumenter.js`, `lib/profiler/localInstrumentationReceiver.js`, and `lib/profiler/instrumentationReceiver.js` were inspired by and largely based on TraceGL. Acorn, included, is also released under the MPL 2.0 license.

# TODOs

* HTML viewer output
* Better visualization, especially for the difference between sync and async runtimes
