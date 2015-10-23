var fs = require('fs');
var path = require('path');

function a () {
  fs.stat(path.join(__dirname, 'async.js'), function (err, stats) {
    if (!err) {
      setTimeout(function () {
        displayStats(stats);
      }, Math.random()*10);
    }
  });
}

function displayStats (stats) {
  // do something with the stats here
}

for (var i = 0; i < (process.argv[2] || 1000); i++) {
  setTimeout(a, 0);
}
