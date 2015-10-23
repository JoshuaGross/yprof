// A test of which functions take the most CPU time / block the event loop
function calculator (numTimes) {
  return function () {
    for (var i = 0; i < 1000*numTimes; i++) {
      Math.pow(1.0000001, i);
    }
  };
}

function calculateInBackground (times) {
  setTimeout(calculator(times), 1);
}

for (var i = 0; i < 100; i++) {
  calculateInBackground(i);
}
