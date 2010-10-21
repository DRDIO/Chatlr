var http   = require('http'),
    url    = require('url'),
    fs     = require('fs'),
    io     = require('./socket.io'),
    sys    = require('sys'),
    server = http.createServer();

server.listen(8080);
		
// socket.io, I choose you
// simplest chat application evar
var socket = io.listen(server),
    buffer = [];
		
socket.on('connection', function(client)
{
    client.send({ buffer: buffer });

    client.on('message', function(response)
    {
	if (response.message) {
            response.message = response.message.substr(0, 200);
        }

        buffer.push(response);
        if (buffer.length > 15) {
            buffer.shift();
        }
        
        client.broadcast(response);
    });

    client.on('disconnect', function()
    {
            client.broadcast({ announcement: client.sessionId + ' disconnected' });
    });
});
