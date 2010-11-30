// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat variables
//
var io        = require('./socket'),
    config    = require('../config/config'),
    
    banned    = {},
    rooms     = {},
    roomCount = 0,
    userCount = 0;
    
module.exports = function(server) {
    var listener;

    listener = io.listen(server, {transports: ['websocket', 'htmlfile', 'xhr-polling']});
    listener.on('connection', function(client)
    {
        try {
            if (!('user' in client) || typeof client.user != 'object') {
                console.log('User is not in client list');
                client._onClose();
                return;
            }

            if (client.user.name in banned) {
                console.log('User is banned!');
                client.send({
                    type:    'notice',
                    message: 'You have been banned.'});
                client._onClose();
                return;
            }

            // Step 2: Check that user isn't already in room
            for (var i in rooms['main'].users) {
                if (rooms['main'].users[i].name == client.user.name) {
                    roomRemoveUser(i);
                    break;
                }
            }

            var currentUser = client.user;

            // Setup user as OPERATOR if in the approval list above
            currentUser.op          = (currentUser.name in config.chatOps) ? true : false;
            currentUser.timestamp   = new Date().getTime();
            currentUser.lastMessage = '';

            // Place into proper room
            roomUpdateUser('main', client.sessionId, currentUser);

            roomSendInit('main', client);

            // Send giant list of existing rooms when user joins
            roomNotifyInit();

            // Broadcast to everyone that this user has connected
            // This will also add the user to their user list
            roomBroadcast('main', {
                type: 'status',
                mode: 'connect',
                id:   client.sessionId,
                user: currentUser});

        } catch(err) {
            console.log('Credentials');
            console.log(err);
            client._onClose();
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        try {
            
            // EVENT: user has sent a message with either credentials or a message
            client.on('message', function(clientRes)
            {
                // Server can receive either credentials or a message to share
                if ('type' in clientRes && typeof clientRes.type == 'string' && clientRes.type in {'message': '', 'credentials': '', 'roomchange': ''}) {

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    // ROOM CHANGE: User is requesting to change rooms
                    if (clientRes.type == 'roomchange' && 'room' in clientRes && typeof clientRes.room == 'string' && clientRes.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
                        try {
                            clientRes.room = clientRes.room.toLowerCase();

                            roomCreate(clientRes.room);
                            roomUpdateUser(clientRes.room, client.sessionId);
                            roomSendInit(clientRes.room, client);
                        } catch(err) {
                            console.log('roomchange');
                            console.log(err);
                        }

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    // MESSAGE: user is sending a message to everyone
                    } else if ('message' in clientRes && typeof clientRes.message == 'string') {
                        try {
                            var currentRoom = roomUserExists(client.sessionId);

                            if (currentRoom) {
                                var currentUser = rooms[currentRoom].users[client.sessionId];
                                var timestamp   = new Date().getTime();
                                var message     = clientRes.message.substr(0, 350);

                                if (currentUser.op) {
                                    if (message.search(/^\/shout/) == 0) {
                                        var shoutMessage = 'Server Message: ' + message.substr(7);
                                        socket.broadcast({
                                            type: 'status',
                                            message: shoutMessage});
                                        return;

                                    } else if (message.search(/^\/topic/) == 0) {
                                        var topic = message.substr(7);
                                        rooms[currentRoom].topic = topic;
                                        roomBroadcast(currentRoom, {
                                            type:  'topic',
                                            topic: topic});
                                        return;

                                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                                        var split = message.split(' ');
                                        var name  = split[1];
                                        var room  = (2 in split ? split[2] : false);

                                        if (room) {
                                            var moveId = false;
                                            for (var i in rooms) {
                                                for (var j in rooms[i].users) {
                                                    if (name == rooms[i].users[j].name) {
                                                        moveId = j;
                                                        break;
                                                    }
                                                }
                                            }

                                            if (moveId) {
                                                roomCreate(room);
                                                roomUpdateUser(room, moveId);
                                                roomSendInit(room, socket.clients[moveId]);

                                                // Let everyone know that someone has been moved
                                                roomBroadcast(currentRoom, {
                                                    type: 'status',
                                                    message: 'has been kicked to #' + room + ' Room',
                                                    id: moveId});
                                            }
                                        } else {
                                            roomDropUser(currentRoom, name, 'has been kicked...');
                                        }

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
                                            var duration    = (2 in split ? (timestamp + parseInt(split[2]) * 60000) : -1);
                                            var durationMsg = (duration != -1 ? ' for ' + split[2] + ' minutes' : '');
                                            banned[name]    = duration;

                                            // Tell everyone they have been banned, with possible time
                                            roomDropUser(currentRoom, name, 'has been banned' + durationMsg + '...');
                                        }
                                        return;
                                    }
                                }

                                // If there is a message and it isn't the same as their last (griefing)
                                if (message.length > 0 && (currentUser.op || (
                                        !(currentUser.name in banned) &&
                                        message != currentUser.lastMessage &&
                                        timestamp - currentUser.timestamp > 2000))) {

                                    if (message.search(/^\/away/) == 0) {
                                        roomBroadcast(currentRoom, {
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
                                    currentUser.timestamp   = timestamp;
                                    currentUser.lastMessage = message;

                                    // Push messages into buffer for user logins
                                    rooms[currentRoom].buffer.push({
                                        type:    'message',
                                        user:    currentUser,
                                        message: message});

                                    if (rooms[currentRoom].buffer.length > 15) {
                                        rooms[currentRoom].buffer.shift();
                                    }

                                    // Broadcast message to everyone
                                    roomBroadcast(currentRoom, {
                                        type:    'message',
                                        id:      client.sessionId,
                                        message: message});
                                }
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
            });

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // EVENT: Disconnect
            //
            client.on('disconnect', function()
            {
                console.log('discconect');
                try {
                    roomRemoveUser(client.sessionId);

                } catch(err) {
                    // Something didn't work during disconnect
                    console.log('Unable to Disconnect');
                    console.log(err);
                }
            });
        } catch(err) {
            // Something didn't work during disconnect
            console.log('Unable to Connect');
            console.log(err);
        }
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup featured rooms that last forever
    //
    roomCreateFeatured(config.chatRooms);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // TODO: DOCUMENT EVERYTHING ELSE
    //
    function roomUserExists(sessionId) {
        for (var i in rooms) {
            if (sessionId in rooms[i].users) {
                return i;
            }
        }
        return false;
    }

    function roomSendInit(room, client)
    {
        client.send({
            type:   'approved',
            id:     client.sessionId,
            room:   room,
            topic:  rooms[room].topic,
            buffer: rooms[room].buffer,
            users:  rooms[room].users});
    }

    function roomRemoveUser(sessionId)
    {
        // Find user in its previous room and remove it
        for (var i in rooms) {
            if (sessionId in rooms[i].users) {
                var oldUser = rooms[i].users[sessionId];

                delete rooms[i].users[sessionId];
                rooms[i].userCount--;
                console.log(sessionId + ' removed from room ' + i);

                // Delete empty rooms (Except for main room)
                if (!rooms[i].featured && rooms[i].userCount <= 0) {
                    delete rooms[i];
                    roomCount--;
                    console.log('room ' + i + ' deleted');

                    roomNotifyDelete(i);
                } else {
                    roomBroadcast(i, {
                        type: 'status',
                        mode: 'disconnect',
                        id:   sessionId});

                    if (!rooms[i].hidden) {
                        roomNotifyChange(i, rooms[i].userCount, rooms[i].featured);
                    }
                }

                return oldUser;
            }
        }

        return false;
    }

    function roomNotifyDelete(roomName)
    {
        listener.broadcast({
            type: 'room',
            mode: 'delete',
            room: roomName});
    }

    function roomNotifyChange(roomName, userCount, featured)
    {
        listener.broadcast({
            type: 'room',
            mode: 'change',
            room: roomName,
            count: userCount,
            featured: featured});
    }

    function roomNotifyInit()
    {
        for (var i in rooms) {
            if (!rooms[i].hidden) {
                roomNotifyChange(i, rooms[i].userCount, rooms[i].featured);
            }
        }
    }

    function roomCreate(roomName, featured)
    {
        // If Room does not exist, CREATE IT
        if (!(roomName in rooms)) {
            rooms[roomName] = {
                topic:     'Anything',
                buffer:    [],
                users:     {},
                userCount: 0,
                featured:  featured,
                hidden:    (roomName.substr(0, 1) == '!')};
            roomCount++;
            console.log(roomName + ' created.');

            if (!rooms[roomName].hidden) {
                roomNotifyChange(roomName, 0, rooms[roomName].featured);
            }
        }
    }

    function roomCreateFeatured(roomNames) {
        for (var i in roomNames) {
            roomCreate(i, true);
        }
    }
    function roomUpdateUser(roomName, sessionId, newUser)
    {
        // If user is not moving to the same room
        if (!(sessionId in rooms[roomName].users)) {
            var oldUser = roomRemoveUser(sessionId);
            var user    = newUser ? newUser : oldUser;

            rooms[roomName].users[sessionId] = user;
            rooms[roomName].userCount++;
            console.log(user.name + ' added to room ' + roomName);

            roomBroadcast(roomName, {
                type: 'status',
                mode: 'connect',
                id:   sessionId,
                user: user});

            if (!rooms[roomName].hidden) {
                roomNotifyChange(roomName, rooms[roomName].userCount, rooms[roomName].featured);
            }
        }
    }

    function roomBroadcast(roomName, object)
    {
        for (var i in rooms[roomName].users) {
            if (i in listener.clients) {
                listener.clients[i].send(object);
            } else {
                roomRemoveUser(i);
            }
        }
    }

    function roomDropUser(roomName, name, message)
    {
        for (var j in rooms[roomName].users) {
            // You cannot ban or kick OPs
            if (rooms[roomName].users[j].name == name && !rooms[roomName].users[j].op) {
                // Broadcast to everyone that this user has disconnected
                // This will remove user from their list
                roomBroadcast(roomName, {
                    type:    'status',
                    message: message,
                    id:      j});

                // Remove user and last grief from server
                listener.clients[j].connection.end();
                return;
            }
        }
    }

    // Perform memoery cleanup on everything
    setInterval(function()
    {
        try {
            roomCount = 0;
            userCount = 0;

            var timestamp = new Date().getTime();

            for (i in rooms) {
                rooms[i].userCount = 0;

                for (j in rooms[i].users) {
                    if (j in listener.clients) {
                        rooms[i].userCount++;
                    } else {
                        delete rooms[i].users[j];
                    }
                }

                if (rooms[i].userCount != 0 || rooms[i].featured) {
                    userCount += rooms[i].userCount;
                    roomCount++;
                } else {
                    delete rooms[i];
                }
            }

            for (i in banned) {
                if (banned[i] != -1 && banned[i] < timestamp) {
                    delete banned[i];
                    console.log(i + ' has been unbanned');
                }
            }
        } catch(err) {
            console.log('Error with data cleanup');
            console.log(err);
        }
    }, 60000);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Connect Handler, must skip to next() on failure else allow 'upgrade' responses
    //
    var handler = function(req, res, next)
    {
        if (req.upgrade) {
            if (!listener.check(req, res, true, req.head)) {
                console.log('Ending response due to invalid check');
                res.end();
                res.destroy();
            }
        } else if (!listener.check(req, res)) {
            next();
        }
    };

    return handler;
};