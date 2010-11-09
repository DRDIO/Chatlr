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

var ops     = {'kevinnuut': '', 'lacey': '', 'gompr': '', 'topherchris': '', 'brittanyforks': '', 'kelseym': '', 'fajita': '', 'vernonvan': ''},
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
    unix = net.createServer(function(stream) {
        try {
            stream.setEncoding('utf8');
            stream.on('data', function(data) {
                var cred = JSON.parse(data);
                if (typeof cred == 'object' && 'key' in cred && 'user' in cred) {
                    cred.user.time  = new Date().getTime();
                    creds[cred.key] = cred.user;
                } else {
                    console.log('Trouble parsing credentials');
                    console.log(data);
                }
            });

            stream.on('end', function() {
                stream.end();
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
                if ('type' in clientRes && typeof clientRes.type == 'string' && clientRes.type in {'message': '', 'credentials': '', 'roomchange': ''}) {

                    // ROOM CHANGE: User is requesting to change rooms
                    if (clientRes.type == 'roomchange' && 'room' in clientRes && typeof clientRes.room == 'string' && clientRes.room.search(/^[a-z0-9-]+$/i) != -1) {
                        try {
                            // If Room does not exist, CREATE IT
                            if (!(clientRes.room in rooms)) {
                                rooms[clientRes.room]           = {};
                                rooms[clientRes.room].users     = {};
                                rooms[clientRes.room].userCount = 0;

                                console.log(users[client.sessionId].name + ' created room ' + clientRes.room);
                            }

                            // If user is not moving to the same room
                            if (!(client.sessionId in rooms[clientRes.room].users)) {
                                rooms[clientRes.room].users[client.sessionId] = new Date().getTime();
                                rooms[clientRes.room].userCount++;

                                console.log(users[client.sessionId].name + ' added to room ' + clientRes.room);

                                // Find user in its previous room and remove it
                                for (var i in rooms) {
                                    if (i != clientRes.room && client.sessionId in rooms[i].users) {
                                        delete(rooms[i].users[client.sessionId]);
                                        rooms[i].userCount--;

                                        console.log(users[client.sessionId].name + ' removed from room ' + i);

                                        // Delete empty rooms
                                        if (rooms[i].userCount <= 0) {
                                            delete(rooms[i]);

                                            console.log('room ' + i + ' deleted');
                                        }
                                    }
                                }
                            }
                        } catch(err) {
                            console.log('roomchange');
                            console.log(err);
                        }
                    
                    // CREDENTIALS: passed from client with authkey to pull from PHP unix socket CREDS
                    } else if (clientRes.type == 'credentials' && 'token' in clientRes && typeof clientRes.token == 'string' && clientRes.token in creds) {
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
                            console.log('credentials');
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

                                } else if (message.search(/^\/ban [a-z0-9-]+( \d+)?/i) == 0) {
                                    // Get the name and duration of ban in minutes
                                    // If duration is blank, set the ban to infinity
                                    var split = message.split(' ');
                                    var name  = split[1];                                    

                                    if (name in banned) {
                                        delete banned[name];
                                    } else {
                                        // Duration in milliseconds
                                        var currentTime = new Date().getTime();
                                        var duration    = (2 in split ? (currentTime + parseInt(split[2]) * 60000) : -1);
                                        banned[name]    = duration;

                                        // Tell everyone they have been banned, with possible time
                                        dropUser(name, 'has been banned' + (duration != -1 ? ' for ' + split[2] + ' minutes' : '') + '...');
                                    }                                    
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

                                // Replace repetitive characters
                                message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

                                // I also hate capslocking
                                if (message.search(/[A-Z ]{6,}/) != -1) {
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
                            console.log('message');
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
                console.log('Unable to parse message');
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
                console.log('Unable to Disconnect');
                console.log(err);
            }
        });

    } catch(err) {
        // Something didn't work during connection, disconnect user
        console.log('Unable to Connect');
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
    try {
        var i,
            userCount = 0,
            credCount = 0,
            roomCount = 0,
            buffCount = 0,
            lastCount = 0,
            time      = new Date().getTime();

        for (i in users) {
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

        for (i in creds) {
            if (time - creds[i].time > 5000) {
                delete creds[i];
            } else {
                credCount++;
            }
        }

        for (i in rooms) {
            roomCount++;
        }

        for (i in buffer) {
            buffCount++;
        }

        for (i in last) {
            lastCount++;
        }

        var currentTime = new Date().getTime();
        for (i in banned) {
            if (banned[i] != -1 && banned[i] < currentTime) {
                delete(banned[i]);
                console.log(i + ' has been unbanned');
            }
        }

        console.log('users: ' + userCount + ' creds: ' + credCount + ' rooms: ' + roomCount + ' buffer: ' + buffCount + ' last: ' + lastCount + ' unix: ' + unix.connections);
    } catch(err) {
        console.log('Error with data cleanup');
        console.log(err);
    }
}, 60000);