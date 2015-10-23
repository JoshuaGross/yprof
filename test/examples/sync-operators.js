function F () {
  var counter = 0;

  return {
    prop: 0,
    get counter () {
      return counter;
    },
    set counter (val) {
      counter = val;
    },
    get lameCounter () {
      return 0;
    }
  };
}

var assert = function (val, expect) {
  if (val !== expect) {
    throw new Error();
  }
}

var f = new F();
assert(f.lameCounter++, 0);
assert(f.lameCounter++, 0);
assert(++f.lameCounter, 1);
assert(--f.lameCounter, -1);
assert(f.counter++, 0);
assert(f.counter++, 1);
assert(++f.counter, 3);
assert(++f.counter, 4);
assert(--f.counter, 3);
assert(f.counter--, 3);
assert(f.prop++, 0);
assert(f.prop++, 1);
assert(++f.prop, 3);
assert(++f.prop, 4);
assert(--f.prop, 3);
assert(f.prop--, 3);
