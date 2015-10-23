function a () {
	setTimeout(b, 1);
}

function a2 () {
	setTimeout(b, 0);
}

function b () {
	setTimeout(c, 0);
}

function c () {
	return 'hello world';
}

for (var i = 0; i < 1000; i++) {
	setTimeout(a, 0);
	setTimeout(a2, 0);
}

