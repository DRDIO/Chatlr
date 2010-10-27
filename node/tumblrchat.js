process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

var http = require('http'),
    url  = require('url'),
    fs   = require('fs'),
    io   = require('./socket.io'),
    sys  = require('sys'),
    net  = require('net');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

var ops     = {'kevinnuut': '', 'lacey': '', 'gompr': '', 'topherchris': '', 'brittanyforks': '', 'kelseym': ''},
    banned  = {},
    creds   = {},
    buffer  = [],
    rooms   = {},
    users   = {},
    last    = {},
    topic   = 'Anything',

    // Create server to listen on port 8080 for IO
    server = http.createServer(),

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // Create unix socket to talk to PHP server
    unix   = net.createServer(function(stream) {
        try {
            // stream.setEncoding('utf8');
            stream.on('data', function(data) {
                var cred = JSON.parse(data);
                if (typeof cred == 'object' && 'key' in cred) {
                    console.log('Credentials for ' + cred.user.name + ' received.');
                    cred.user.time  = new Date().getTime();
                    creds[cred.key] = cred.user;
                }
            });
        } catch(err) {
            console.log(err);
        }
    });

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

// Server listens on port 8080 and connect socket for PHP server talk
server.listen(8080);
unix.listen('unix.socket');

// Create IO socket
var socket = io.listen(server, {transports: ['websocket']});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

// EVENT: user has connected, initialize them and ask for credentials
socket.on('connection', function(client)
{
    try {
        // Send the client their init message
        // along with last 15 messages and user list
        client.send({
            type:   'init',
            id:     client.sessionId,
            topic:  topic,
            buffer: buffer,
            users:  users});

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: user has sent a message with either credentials or a message
        client.on('message', function(clientRes)
        {
            try {
                // Server can receive either credentials or a message to share
                if ('type' in clientRes && typeof clientRes.type == 'string' && clientRes.type in {'message': '', 'credentials': ''}) {

                    // CREDENTIALS: passed from client with authkey to pull from PHP unix socket CREDS
                    if (clientRes.type == 'credentials' && 'token' in clientRes && typeof clientRes.token == 'string' && clientRes.token in creds) {
                        try {
                            // Check if user is already in chat to prevent duplicates
                            for (var i in users) {
                                if (users[i].name == creds[clientRes.token].name) {
                                    console.log('User already in chat!');
                                    delete creds[clientRes.token];
                                    client.connection.end();
                                    return;
                                }
                            }

                            if (creds[clientRes.token].name in banned) {
                                console.log('User is banned!');
                                delete creds[clientRes.token];
                                client.connection.end();
                                return;
                            }

                            // Transfer creds to user list and delete from php server creds
                            var currentUser = users[client.sessionId] = creds[clientRes.token];
                            delete creds[clientRes.token];

                            // Setup user as OPERATOR if in the approval list above
                            currentUser.op = (currentUser.name in ops);

                            // Initialize last message for griefing
                            last[client.sessionId] = {
                                timestamp: 0,
                                message: ''};

                            // Broadcast to everyone that this user has connected
                            // This will also add the user to their user list
                            socket.broadcast({
                                type: 'status',
                                mode: 'connect',
                                id:   client.sessionId,
                                user: currentUser});
                        } catch(err) {
                            client.disconnect.end();
                            console.log(err);
                        }

                    // MESSAGE: user is sending a message to everyone
                    } else if ('message' in clientRes && typeof clientRes.message == 'string' && client.sessionId in users) {
                        try {
                            var timestamp = new Date().getTime();
                            var message   = clientRes.message.substr(0, 350);

                            if (users[client.sessionId].op) {;
                                if (message.search(/^\/topic/) == 0) {
                                    topic = message.substr(7);
                                    socket.broadcast({
                                        type:  'topic',
                                        topic: topic});
                                    return;

                                } else if (message.search(/^\/kick [a-z0-9-]+/i) == 0) {
                                    var name = message.substr(6);
                                    dropUser(name, 'has been kicked...');
                                    return;

                                } else if (message.search(/^\/ban [a-z0-9-]+/i) == 0) {
                                    var name = message.substr(5);
                                    if (name in banned) {
                                        delete banned[name];
                                    } else {
                                        banned[name] = '';
                                    }

                                    dropUser(name, 'has been banned...');
                                    return;
                                }
                            }

                            // If there is a message and it isn't the same as their last (griefing)
                            if (message.length > 0 && client.sessionId in last &&                                
                                (users[client.sessionId].op || (
                                    !(users[client.sessionId].name in banned) &&
                                    message != last[client.sessionId].message &&
                                    timestamp - last[client.sessionId].timestamp > 2500))) {

                                if (message.search(/^\/away/) == 0) {
                                    socket.broadcast({
                                        type:    'status',
                                        mode:    'away',
                                        id:      client.sessionId});
                                    return;
                                }

                                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                                message = message.replace(/(niggah|nigger|nigga)/i, 'ninja');
                                message = message.replace(/follow(ing|ed)?( me)?/i, 'avoid$1$2');

                                // I hate similar charactesr in a row
                                message = message.replace(/(.+?)\1{4,}/g, '$1');

                                // I also hate capslocking
                                if (message.search(/[A-Z ]{5,}/) != -1) {
                                    message = message.toLowerCase();
                                }

                                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

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
                                socket.broadcast({
                                    type:    'message',
                                    id:      client.sessionId,
                                    message: message});
                            }
                        } catch(err) {
                            console.log(err);
                        }

                    } else {
                        // Invalid message type sent, disconnect user
                        console.log('invalid message');
                        console.log(clientRes);
                    }

                } else {
                    // Invalid properties sent, disconnect user
                    console.log('invalid type');
                    console.log(clientRes);
                }
            } catch(err) {
                // Something didn't work during connection, disconnect user
                console.log('Unable to parse message ' + client.sessionId);
                console.log(err);
            }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: Disconnect
        client.on('disconnect', function()
        {
            try {
                // Remove user and last grief from server
                if (client.sessionId in users) {
                    delete users[client.sessionId];
                    delete last[client.sessionId];
                }

                if (client.sessionId in last) {
                    delete last[client.sessionId];
                }
                
                // Broadcast to everyone that this user has disconnected
                // This will remove user from their list
                client.broadcast({
                    type:    'status',
                    mode:    'disconnect',
                    id:      client.sessionId});

            } catch(err) {
                // Something didn't work during disconnect
                console.log('Unable to disconnect ' + client.sessionId);
                console.log(err);
            }
        });

    } catch(err) {
        // Something didn't work during connection, disconnect user
        console.log('Unable to connect ' + client.sessionId);
        console.log(err);
        
        if (client.sessionId in users) {
            delete users[client.sessionId];
        }

        if (client.sessionId in last) {
            delete last[client.sessionId];
        }
    }
});

function dropUser(name, message) {
    for (var i in users) {
        if (users[i].name == name && !users[i].op) {
            socket.clients[i].connection.end();

            // Remove user and last grief from server
            delete users[i];

            if (i in last) {
                delete last[i];
            }

            // Broadcast to everyone that this user has disconnected
            // This will remove user from their list
            socket.broadcast({
                type:    'status',
                message: message,
                id:      i});
            return;
        }
    }
}

// Perform memoery cleanup on everything
setInterval(function()
{
    var userCount = 0,
        credCount = 0,
        roomCount = 0,
        buffCount = 0,
        lastCount = 0,
        time      = new Date().getTime();

    for (var i in users) {
        var userExists = false;
        for (var i in socket.clients) {
            if (socket.clients[i].sessionId == i) {
                userExists = true;
                break;
            }
        }

        if (!userExists) {
            delete users[i];
            if (i in last) {
                delete last[i];
            }
        } else {
            userCount++;
        }
    }

    for (var i in creds) {
        if (time - creds[i].time > 5000) {
            delete creds[i];
        } else {
            credCount++;
        }
    }

    for (var i in rooms) {
        roomCount++;
    }

    for (var i in buffer) {
        buffCount++;
    }

    for (var i in last) {
        lastCount++;
    }

    console.log('users: ' + userCount + ' creds: ' + credCount + ' rooms: ' + roomCount + ' buffer: ' + buffCount + ' last: ' + lastCount);
}, 300000);