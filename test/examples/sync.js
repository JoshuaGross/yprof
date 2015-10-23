function a () {
	return b();
}

function a2 () {
	return b();
}

function b () {
	return c();
}

function c () {
	return 'hello world';
}

for (var i = 0; i < 1000; i++) {
	a();
	a2();
}
