var net    = require('net'),
    server = net.createServer(function(stream) {
        stream.setEncoding('utf8');
        stream.on('connect', function() {
                console.log('connected');
        });
        stream.on('data', function(data) {
		var user = JSON.parse(data);
                console.log(user.title);
        });
    }).listen('test.txt');

