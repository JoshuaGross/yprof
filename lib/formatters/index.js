module.exports = {
  'gprof-flat': require('./gprof/flat'),
  'gprof-callgraph': require('./gprof/callgraph'),
  'yprof-html': require('./yprof/html'),
  'yprof-dot': require('./yprof/dot'),
  'yprof-sync-bottlenecks': require('./yprof/sync-bottlenecks'),
  'raw-callgraph': require('./raw/callgraph'),
  'raw': require('./raw/raw')
};
