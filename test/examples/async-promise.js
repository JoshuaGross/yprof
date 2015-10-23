// Test async traces with promises
var Promise = require('bluebird');

function a () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(1);
    }, 10);
  });
}

function b () {
  return 'intermediate result';
}

a().then(function () {
  return b();
}).then(function () {
  return 'hello world';
});
