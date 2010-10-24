var http = require('http'),
    url  = require('url'),
    fs   = require('fs'),
    io   = require('./socket.io'),
    sys  = require('sys'),
    net  = require('net');

var creds  = {},
    buffer = [],
    rooms  = {},
    users  = {},
    last   = {},

    server = http.createServer(),

    unix   = net.createServer(function(stream) {
        stream.setEncoding('utf8');
        stream.on('data', function(data) {
            console.log('Streaming');
            var cred = JSON.parse(data);
            if (typeof cred == 'object' && 'id' in cred) {
                 creds[cred.id] = cred;
                 console.log('Credentials for ' + cred.title + ' established');
            }
        });
    });

server.listen(8080);
unix.listen('unix.socket');

var socket = io.listen(server, {transports: ['websocket']});

// EVENT: user has connected, initialize them and ask for credentials
socket.on('connection', function(client)
{
    // Send the client their init message
    // along with last 15 messages and user list
    var topic = 'No topic today, folks!';
    if (2 in process.argv) {
        topic = process.argv[2];
    }

    client.send({
        type:   'init',
        topic:  topic,
        id:     client.sessionId,
        buffer: buffer,
        users:  users});

    // EVENT: user has sent a message with either credentials or a message
    client.on('message', function(clientRes)
    {
        // Server can receive either credentials or a message to share
        if ('type' in clientRes && clientRes.type in {'message': '', 'credentials': ''}) {
            // First response from user, setup their account in list
            if (clientRes.type == 'credentials' && 
                'title'  in clientRes && typeof clientRes.title  == 'string' &&
                'name'   in clientRes && typeof clientRes.name   == 'string' &&
                'url'    in clientRes && typeof clientRes.url    == 'string' &&
                'avatar' in clientRes && typeof clientRes.avatar == 'string') {

                // Initialize last message for griefing
                last[client.sessionId] = {
                    timestamp: 0,
                    message: ''};

                // connect is the first message from client
                // we need to add their credentials to the user list
                users[client.sessionId] = {
                    title:  clientRes.title,
                    name:   clientRes.name,
                    url:    clientRes.url,
                    avatar: clientRes.avatar};

                // Broadcast to everyone that this user has connected
                // This will also add the user to their user list
                client.broadcast({
                    type:    'status',
                    mode:    'connect',
                    id:      client.sessionId,
                    user:    users[client.sessionId],
                    message: 'joined the chat!'});

            // user is sending a message to everyone
            } else if ('message' in clientRes && typeof clientRes.message == 'string') {
                var timestamp = new Date().getTime();
                var message   = clientRes.message.substr(0, 350);
                // If there is a message and it isn't the same as their last (griefing)
                if (message.length > 0 && client.sessionId in last &&
                    'message' in last[client.sessionId] &&
                    'timestamp' in last[client.sessionId] &&
                    message != last[client.sessionId].message &&
                    timestamp - last[client.sessionId].timestamp > 3000) {

                    // Store last message to track griefing
                    last[client.sessionId] = {
                        timestamp: timestamp,
                        message:   message};

                    // Push messages into buffer for user logins
                    buffer.push({
                        type:    'message',
                        user:    users[client.sessionId],
                        message: message});

                    if (buffer.length > 15) {
                        buffer.shift();
                    }  

                    // Broadcast message to everyone
                    client.broadcast({
                        type:    'message',
                        id:      client.sessionId,
                        message: message});
                }
            }
        }              
    });

    // EVENT: Disconnect
    client.on('disconnect', function()
    {
        // Remove user and last grief from server
        delete users[client.sessionId];
        delete last[client.sessionId];

        // Broadcast to everyone that this user has disconnected
        // This will remove user from their list
        client.broadcast({
            type:    'status',
            mode:    'disconnect',
            id:      client.sessionId,
            message: 'left the chat...'});
    });
});
