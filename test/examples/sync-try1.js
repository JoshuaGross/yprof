function a () {
    try {
        b();
    } catch (e) {
        c();
    }
}

function b () {
    throw new Error();
}

function c () {
    return 'hello world';
}

a();
