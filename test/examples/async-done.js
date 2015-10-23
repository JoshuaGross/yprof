function a (callback) {
	return setTimeout(b, 0);
}

function b (callback) {
	return setTimeout(c, 0);
}

function c (callback) {
	return setTimeout(callback, 0);
}

a(function completed () {
	// completed
});
