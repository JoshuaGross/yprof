function A () {
    this.b = b();
}
function b () {
    return c();
}
function c () {
    return function () { return 'hello world' };
}

function aFactory () {
    return new A();
}

function aFactory2 () {
    return new A;
}

new A().b();
aFactory().b();
aFactory2().b();
