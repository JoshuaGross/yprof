// The standard NodeJS echo server! Make sure that nothing strange happens with
//  networked apps.
var net = require('net');

var server = net.createServer(function connectionCallback (socket) {
  socket.write('Echo server\r\n');
  socket.pipe(socket);
});

server.listen(1337, '127.0.0.1');
