// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Extension variables
//
var io     = module.exports = require('./socket'),
    config = require('../config/config');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Room and Banned User Vars
//
io.Listener.prototype.chatBanned    = {};
io.Listener.prototype.chatRooms     = {};
io.Listener.prototype.chatRoomCount = 0;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Connection for a Client
//
io.Listener.prototype.chatConnection = function(client)
{
    var listener = this;
    
    try {
        if (!('user' in client)) {
            console.log('User is not in client list');
            client._onClose();
            return;
        }

        if (client.user.name in listener.chatBanned) {
            console.log('User is banned!');
            client.send({
                type:    'notice',
                message: 'You have been banned.'});
            client._onClose();
            return;
        }

        // Step 2: Check that user isn't already in room
        for (var i in listener.chatRooms['main'].users) {
            if (listener.chatRooms['main'].users[i].name == client.user.name) {
                listener.roomRemoveUser(i);
                break;
            }
        }

        var currentUser = client.user;

        // Setup user as OPERATOR if in the approval list above
        currentUser.op          = (currentUser.name in config.chatOps) ? true : false;
        currentUser.timestamp   = new Date().getTime();
        currentUser.lastMessage = '';

        // Place into proper room
        listener.roomUpdateUser('main', client.sessionId, currentUser);

        listener.roomSendInit('main', client);

        // Send giant list of existing listener.chatRooms when user joins
        listener.roomNotifyInit();

        // Broadcast to everyone that listener user has connected
        // This will also add the user to their user list
        listener.roomBroadcast('main', {
            type: 'status',
            mode: 'connect',
            id:   client.sessionId,
            user: currentUser});

    } catch(err) {
        client._onClose();
        throw err;
    }
}

// 'this' references 'client'
io.Listener.prototype.chatMessage = function(clientRes)
{
    // Server can receive either credentials or a message to share
    if ('type' in clientRes && typeof clientRes.type == 'string' && clientRes.type in {'message': '', 'credentials': '', 'roomchange': ''}) {

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOM CHANGE: User is requesting to change this.listener.chatRooms
        //
        if (clientRes.type == 'roomchange' && 'room' in clientRes && typeof clientRes.room == 'string' && clientRes.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
            clientRes.room = clientRes.room.toLowerCase();

            this.listener.roomCreate(clientRes.room);
            this.listener.roomUpdateUser(clientRes.room, this.sessionId);
            this.listener.roomSendInit(clientRes.room, this);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // MESSAGE: user is sending a message to everyone
        //
        } else if ('message' in clientRes && typeof clientRes.message == 'string') {
            var currentRoom = this.listener.roomUserExists(this.sessionId);

            if (currentRoom) {
                var currentUser = this.listener.chatRooms[currentRoom].users[this.sessionId];
                var timestamp   = new Date().getTime();
                var message     = clientRes.message.substr(0, 350);

                if (currentUser.op) {
                    if (message.search(/^\/shout/) == 0) {
                        var shoutMessage = 'Server Message: ' + message.substr(7);
                        this.listener.broadcast({
                            type: 'status',
                            message: shoutMessage});
                        return;

                    } else if (message.search(/^\/topic/) == 0) {
                        var topic = message.substr(7);
                        this.listener.chatRooms[currentRoom].topic = topic;
                        this.listener.roomBroadcast(currentRoom, {
                            type:  'topic',
                            topic: topic});
                        return;

                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                        var split = message.split(' ');
                        var name  = split[1];
                        var room  = (2 in split ? split[2] : false);

                        if (room) {
                            var moveId = false;
                            for (var i in this.listener.chatRooms) {
                                for (var j in this.listener.chatRooms[i].users) {
                                    if (name == this.listener.chatRooms[i].users[j].name) {
                                        moveId = j;
                                        break;
                                    }
                                }
                            }

                            if (moveId) {
                                this.listener.roomCreate(room);
                                this.listener.roomUpdateUser(room, moveId);
                                this.listener.roomSendInit(room, this.listener.clients[moveId]);

                                // Let everyone know that someone has been moved
                                this.listener.roomBroadcast(currentRoom, {
                                    type: 'status',
                                    message: 'has been kicked to #' + room + ' Room',
                                    id: moveId});
                            }
                        } else {
                            this.listener.roomDropUser(currentRoom, name, 'has been kicked...');
                        }

                        return;

                    } else if (message.search(/^\/ban [a-z0-9-]+( \d+)?/i) == 0) {
                        // Get the name and duration of ban in minutes
                        // If duration is blank, set the ban to infinity
                        var split = message.split(' ');
                        var name  = split[1];

                        if (name in this.listener.chatBanned) {
                            delete this.listener.chatBanned[name];
                        } else {
                            // Duration in milliseconds
                            var duration    = (2 in split ? (timestamp + parseInt(split[2]) * 60000) : -1);
                            var durationMsg = (duration != -1 ? ' for ' + split[2] + ' minutes' : '');
                            this.listener.chatBanned[name]    = duration;

                            // Tell everyone they have been banned, with possible time
                            this.listener.roomDropUser(currentRoom, name, 'has been banned' + durationMsg + '...');
                        }
                        return;
                    }
                }

                // If there is a message and it isn't the same as their last (griefing)
                if (message.length > 0 && (currentUser.op || (
                        !(currentUser.name in this.listener.chatBanned) &&
                        message != currentUser.lastMessage &&
                        timestamp - currentUser.timestamp > 2000))) {

                    if (message.search(/^\/away/) == 0) {
                        this.listener.roomBroadcast(currentRoom, {
                            type:    'status',
                            mode:    'away',
                            id:      this.sessionId});
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
                    this.listener.chatRooms[currentRoom].buffer.push({
                        type:    'message',
                        user:    currentUser,
                        message: message});

                    if (this.listener.chatRooms[currentRoom].buffer.length > 15) {
                        this.listener.chatRooms[currentRoom].buffer.shift();
                    }

                    // Broadcast message to everyone
                    this.listener.roomBroadcast(currentRoom, {
                        type:    'message',
                        id:      this.sessionId,
                        message: message});
                }
            }

        } else {
            // Invalid message type sent, disconnect user
            console.log('Invalid Message');
        }

    } else {
        // Invalid properties sent, disconnect user
        console.log('Invalid Type');
    }
}

io.Listener.prototype.chatDisconnect = function()
{
    this.listener.roomRemoveUser(this.sessionId);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// TODO: DOCUMENT EVERYTHING ELSE
//
io.Listener.prototype.roomUserExists = function(sessionId) {
    for (var i in this.chatRooms) {
        if (sessionId in this.chatRooms[i].users) {
            return i;
        }
    }
    return false;
}

io.Listener.prototype.roomSendInit = function(room, client)
{
    client.send({
        type:   'approved',
        id:     client.sessionId,
        room:   room,
        topic:  this.chatRooms[room].topic,
        buffer: this.chatRooms[room].buffer,
        users:  this.chatRooms[room].users});
}

io.Listener.prototype.roomRemoveUser = function(sessionId)
{
    // Find user in its previous room and remove it
    for (var i in this.chatRooms) {
        if (sessionId in this.chatRooms[i].users) {
            var oldUser = this.chatRooms[i].users[sessionId];

            delete this.chatRooms[i].users[sessionId];
            this.chatRooms[i].userCount--;
            // console.log(sessionId + ' removed from room ' + i);

            // Delete empty this.chatRooms (Except for main room)
            if (!this.chatRooms[i].featured && this.chatRooms[i].userCount <= 0) {
                delete this.chatRooms[i];
                this.chatRoomCount--;
                // console.log('room ' + i + ' deleted');

                this.roomNotifyDelete(i);
            } else {
                this.roomBroadcast(i, {
                    type: 'status',
                    mode: 'disconnect',
                    id:   sessionId});

                if (!this.chatRooms[i].hidden) {
                    this.roomNotifyChange(i, this.chatRooms[i].userCount, this.chatRooms[i].featured);
                }
            }

            return oldUser;
        }
    }

    return false;
}

io.Listener.prototype.roomNotifyDelete = function(roomName)
{
    this.broadcast({
        type: 'room',
        mode: 'delete',
        room: roomName});
}

io.Listener.prototype.roomNotifyChange = function(roomName, userCount, featured)
{
    this.broadcast({
        type: 'room',
        mode: 'change',
        room: roomName,
        count: userCount,
        featured: featured});
}

io.Listener.prototype.roomNotifyInit = function()
{
    for (var i in this.chatRooms) {
        if (!this.chatRooms[i].hidden) {
            this.roomNotifyChange(i, this.chatRooms[i].userCount, this.chatRooms[i].featured);
        }
    }
}

io.Listener.prototype.roomCreate = function(roomName, featured)
{    
    // If Room does not exist, CREATE IT
    if (!(roomName in this.chatRooms)) {
        this.chatRooms[roomName] = {
            topic:     'Anything',
            buffer:    [],
            users:     {},
            userCount: 0,
            featured:  featured,
            hidden:    (roomName.substr(0, 1) == '!')};
        this.chatRoomCount++;
        // console.log(roomName + ' created.');

        if (!this.chatRooms[roomName].hidden) {
            this.roomNotifyChange(roomName, 0, this.chatRooms[roomName].featured);
        }
    }
}

io.Listener.prototype.roomCreateFeatured = function(roomNames) {
    for (var i in roomNames) {
        this.roomCreate(i, true);
    }
}
io.Listener.prototype.roomUpdateUser = function(roomName, sessionId, newUser)
{
    // If user is not moving to the same room
    if (!(sessionId in this.chatRooms[roomName].users)) {
        var oldUser = this.roomRemoveUser(sessionId);
        var user    = newUser ? newUser : oldUser;

        this.chatRooms[roomName].users[sessionId] = user;
        this.chatRooms[roomName].userCount++;
        // console.log(user.name + ' added to room ' + roomName);

        this.roomBroadcast(roomName, {
            type: 'status',
            mode: 'connect',
            id:   sessionId,
            user: user});

        if (!this.chatRooms[roomName].hidden) {
            this.roomNotifyChange(roomName, this.chatRooms[roomName].userCount, this.chatRooms[roomName].featured);
        }
    }
}

io.Listener.prototype.roomBroadcast = function(roomName, object)
{
    for (var i in this.chatRooms[roomName].users) {
        if (i in this.clients) {
            this.clients[i].send(object);
        } else {
            this.roomRemoveUser(i);
        }
    }
}

io.Listener.prototype.roomDropUser = function(roomName, name, message)
{
    for (var j in this.chatRooms[roomName].users) {
        // You cannot ban or kick OPs
        if (this.chatRooms[roomName].users[j].name == name && !this.chatRooms[roomName].users[j].op) {
            // Broadcast to everyone that this user has disconnected
            // This will remove user from their list
            this.roomBroadcast(roomName, {
                type:    'status',
                message: message,
                id:      j});

            // Remove user and last grief from server
            this.clients[j].connection.end();
            return;
        }
    }
}

io.Listener.prototype.chatClean = function(listener)
{
    var timestamp = new Date().getTime();

    for (i in listener.chatRooms) {
        listener.chatRooms[i].userCount = 0;

        for (j in listener.chatRooms[i].users) {
            if (j in listener.clients) {
                listener.chatRooms[i].userCount++;
            } else {
                delete listener.chatRooms[i].users[j];
            }
        }

        if (listener.chatRooms[i].userCount == 0 && !listener.chatRooms[i].featured) {
            delete listener.chatRooms[i];
        }
    }

    for (i in listener.chatBanned) {
        if (listener.chatBanned[i] != -1 && listener.chatBanned[i] < timestamp) {
            delete listener.chatBanned[i];
            // console.log(i + ' has been unbanned');
        }
    }
}