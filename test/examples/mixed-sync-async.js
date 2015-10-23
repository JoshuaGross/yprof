function a () {
	b();
	setTimeout(b, 1);
}

function b () {
	c();
}

function c () {
	return 'hello world';
}

for (var i = 0; i < (process.argv[2] || 1); i++) {
	a();
}
