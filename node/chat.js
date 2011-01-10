// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Extension variables
//
var config = require('../config/config'),
    io     = module.exports = require('./socket');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Room and Banned User Vars
//
io.Listener.prototype.chatUsers        = {};
io.Listener.prototype.chatBanned       = {};
io.Listener.prototype.chatRooms        = {};
io.Listener.prototype.chatRoomCount    = 0;

io.Listener.prototype.chatMessageTypes = {
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // MESSAGE: user is sending a message to everyone
    //
    'message': function(listener, client, response) {
        if ('message' in response && typeof response.message == 'string') {
            // Get the current room of the user
            var user     = listener.chatUsers[client.userName];
            var roomName = user.roomName;

            if (roomName) {
                var time    = new Date().getTime();
                var message = response.message.substr(0, 350);

                if (user.op) {
                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Shout to Rooms
                    //
                    if (!message.search(/^\/shout/)) {
                        var shoutMessage = 'Server Message: ' + message.substr(7);
                        listener.broadcast({
                            type: 'status',
                            message: shoutMessage});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Set the Topic
                    //
                    } else if (message.search(/^\/topic/) == 0) {
                        var topic = message.substr(7);
                        listener.chatRooms[roomName].topic = topic;
                        listener.roomBroadcast(roomName, {
                            type:  'topic',
                            topic: topic});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Kick User Out or to Another Room
                    //
                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                        var kickSplit = message.split(' ');
                        var kickName  = (1 in kickSplit ? kickSplit[1] : false);

                        if (kickName in listener.chatUsers) {
                            var kickUser = listener.chatUsers[kickName];
                            var kickRoom = (2 in kickSplit ? kickSplit[2] : false);

                            if (kickRoom) {
                                listener.roomUserAdd(kickRoom, kickName);
                                listener.userInitRoom(kickRoom, client);

                                // Let everyone know that someone has been moved
                                listener.roomBroadcast(roomName, {
                                    type: 'status',
                                    message: 'has been kicked to #' + roomName + ' Room',
                                    id: kickUser.name});
                            } else {
                                listener.roomDropUser(roomName, name, 'has been kicked...');
                            }
                        } 

                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Ban User For X Time
                    //
                    } else if (message.search(/^\/ban [a-z0-9-]+( \d+)?/i) == 0) {
                        // Get the name and duration of ban in minutes
                        // If duration is blank, set the ban to infinity
                        var banSplit = message.split(' ');
                        var banUser  = (1 in banSplit ? banSplit[1] : false);

                        if (banUser in listener.chatBanned) {
                            delete listener.chatBanned[banUser];
                        } else {
                            // Duration in milliseconds
                            var duration    = (2 in banSplit ? (time + parseInt(banSplit[2]) * 60000) : -1);
                            var durationMsg = (duration != -1 ? ' for ' + banSplit[2] + ' minutes' : '');
                            listener.chatBanned[banUser]    = duration;

                            // Tell everyone they have been banned, with possible time
                            listener.roomDropUser(roomName, banUser, 'has been banned' + durationMsg + '...');
                        }
                        return;
                    }
                }

                // If there is a message and it isn't the same as their last (griefing)
                if (message.length > 0 && (user.op || (
                        !(user.name in listener.chatBanned) &&
                        message != user.lastMessage &&
                        time - user.tsMessage > 2000))) {

                    if (message.search(/^\/away/) == 0) {
                        listener.roomBroadcast(roomName, {
                            type:    'status',
                            mode:    'away',
                            id:      user.name});
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
                    user.tsMessage   = time;
                    user.lastMessage = message;

                    // Push messages into buffer for user logins
                    listener.chatRooms[roomName].buffer.push({
                        type:    'message',
                        user:    user,
                        message: message});

                    if (listener.chatRooms[roomName].buffer.length > 15) {
                        listener.chatRooms[roomName].buffer.shift();
                    }

                    // Broadcast message to everyone
                    listener.roomBroadcast(roomName, {
                        type:    'message',
                        id:      user.name,
                        message: message});
                }
            }
        }
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // ROOM CHANGE: User is requesting to change listener.chatRooms
    //
    'roomchange': function(listener, client, response) {
        if ('room' in response && typeof response.room == 'string' && response.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
            // standardize room for a link
            var room = response.room.toLowerCase();

            listener.roomUserAdd(room, client.userName);
            listener.userInitRoom(room, client);
        }
    }
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatCleanup
 * Perform garbage cleanup of rogue users
 */
io.Listener.prototype.chatCleanup = function() {
    var listener = this;
    var time     = new Date().getTime();

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // USER CLEANUP
    //
    for (var userName in listener.chatUsers) {
        var user      = listener.chatUsers[userName];
        var sessionId = user.sessionId;

        if (!user.connected) {
            // If user has been disconnected longer than allowed, drop completely
            if (time - user.tsDisconnect > config.interval) {
                listener.userClose(userName);
            }
        } else if (!(sessionId in listener.clients)) {
            // RARE, User says they are connected but no session exists
            // Set to disconnected and give them a grace
            listener.userDisable(userName);
        } else if (!(user.roomName in listener.chatRooms) || !(userName in listener.chatRooms[user.roomName].users)) {
            // RARE user says in room X which doen'st exist or not in room
            listener.roomUserAdd('main', userName);
        }
    }

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // ROOM CLEANUP
    //
    for (var roomName in listener.chatRooms) {
        var room      = listener.chatRooms[roomName];
        var userCount = room.userCount;
        
        // Reset user count and recalculate
        room.userCount = 0;

        for (userName in room.users) {
            if (!(userName in listener.chatUsers)) {
                // User is in room list but not global, delete
                listener.userClose(userName);
            } else {
                room.userCount++;
            }
        }
        
        if (!room.userCount) {
            // Remove room from list
            listener.roomDestroy(roomName);
        } else if (userCount != room.userCount) {
            // Count somehow got off, so update clients with change
            listener.chatRoomNotify(roomName);
        }
    }

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // BAN LIST CLEANUP
    //
    for (var banName in listener.chatBanned) {
        if (listener.chatBanned[banName] != -1 && listener.chatBanned[banName] < time) {
            delete listener.chatBanned[banName];

            console.log(banName + ' has been unbanned');
        }
    }

    console.log('cleanup run');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatInit
 * Initialize Chatroom: Setup rooms and timers
 */
io.Listener.prototype.chatInit = function()
{
    var listener = this;

    for (var roomName in config.chatRooms) {
        // Create each featured room and update list
        listener.roomCreate(roomName, true);
    }

    // Perform memory cleanup on everything
    setInterval(listener.chatCleanup, config.interval);
}


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatRoomNotify
 * Notify EVERYONE of room additions / removals / user changes
 */
io.Listener.prototype.chatRoomNotify = function(roomName, userName)
{
    var listener = this;

    if (roomName in listener.chatRooms) {
        // Room is either new or has user changes, notify
        var room = listener.chatRooms[roomName];

        if (!room.hidden) {
            if (userName) {
                var sessionId = listener.chatUsers[userName].sessionId;
                var client    = listener.clients[sessionId];
                client.send({
                    type: 'room',
                    mode: 'change',
                    room: roomName,
                    count: room.userCount
                });
            } else {
                listener.broadcast({
                    type: 'room',
                    mode: 'change',
                    room: roomName,
                    count: room.userCount
                });
            }
        }
    } else {
        // Room doesn't exist and needs to be removed
        listener.broadcast({
            type: 'room',
            mode: 'delete',
            room: roomName});
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomBroadcast
 * Broadcast a message to a room
 */
io.Listener.prototype.roomBroadcast = function(roomName, object)
{
    var listener = this;

    for (var userName in listener.chatRooms[roomName].users) {
        var sessionId = listener.chatUsers[userName].sessionId;
        
        if (sessionId in listener.clients) {
            listener.clients[sessionId].send(object);
        } else {
            // TODO: This means user could be active!
            listener.userDisable(userName);
        }
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomCreate
 * Create a room from scratch
 */
io.Listener.prototype.roomCreate = function(roomName, featured)
{
    var listener = this;

    // If Room does not exist, CREATE IT
    listener.chatRooms[roomName] = {
        topic:     'Anything',
        buffer:    [],
        users:     {},
        userCount: 0,
        featured:  featured,
        hidden:    (roomName.substr(0, 1) == '!')};
    listener.chatRoomCount++;

    console.log(roomName + ' created.');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomDestroy
 * Delete a room (can even destroy featured rooms)
 */
io.Listener.prototype.roomDestroy = function(roomName)
{
    var listener = this;
    
    delete room;
    listener.chatRoomCount--;
    listener.chatRoomNotify(roomName);

    console.log(roomName + ' removed');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomGetUsers
 * Get full user data as an array
 */
io.Listener.prototype.roomGetUsers = function(roomName)
{
    var listener = this;
    var output   = {};

    for (var userName in listener.chatRooms[roomName].users) {
        output[userName] = listener.chatUsers[userName];
    }

    return output;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomUserAdd
 * Add a user to a room
 * If room does not exist, create it and remove user from other possible rooms
 * If room does exist and user does not exist, add user and inform others
 * If room does exist and user does exist, do nothing
 */
io.Listener.prototype.roomUserAdd = function(roomName, userName)
{
    var listener = this;

    // Check that the room is actually in the list
    if (!(roomName in listener.chatRooms)) {
        listener.roomCreate(roomName);
    }

    var room = listener.chatRooms[roomName];
    var time = new Date().getTime();
    
    if (!(userName in room.users)) {
        // USER IS NEW: add them and notify other users
        room.users[userName] = time;
        room.userCount++;

        // Broadcast to the room of the new user
        listener.roomBroadcast(roomName, {
            type: 'status',
            mode: 'connect',
            id:   userName,
            user: listener.chatUsers[userName]
        });

        // Broadcast to everyone the room count change
        listener.chatRoomNotify(roomName);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Make sure user is removed from other rooms
        //
        for (var otherRoomName in listener.chatRooms) {
            if (otherRoomName != roomName) {
                listener.roomUserRemove(otherRoomName, userName);
            }
        }

        console.log(userName + ' added to room ' + roomName);
    } else {
        // TODO: Handle reconnects
        var user = listener.chatUsers[userName];

        // Show user as active again
        listener.userEnable(userName);

        console.log(userName + ' reconnected to ' + roomName);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomUserRemove
 * Remove a user from a room
 */
io.Listener.prototype.roomUserRemove = function(roomName, userName, message)
{
    var listener = this;
    var room     = listener.chatRooms[roomName];
    
    // Check that user is actually in the room
    if (userName in room.users) {
        delete room.users[userName];
        room.userCount--;

        if (!room.featured && room.userCount <= 0) {
            // Get rid of this room
            listener.roomDestroy(roomName);
        } else {
            if (message) {
                listener.roomBroadcast(roomName, {
                    type:    'status',
                    message: message,
                    id:      userName
                });
            } else {
                listener.roomBroadcast(roomName, {
                    type: 'status',
                    mode: 'disconnect',
                    id:   userName});
            }

            listener.chatRoomNotify(roomName);
        }

        console.log(userName + ' removed from room ' + roomName);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userDisable
 * Disable a user in a room, setting them to idle for the moment
 */
io.Listener.prototype.userDisable = function(userName)
{
    var listener = this;
    var time     = new Date().getTime();
    var user     = listener.chatUsers[userName];

    user.connected    = false;
    user.tsDisconnect = time;

    listener.roomBroadcast(user.roomName, {
        type:    'status',
        mode:    'idle',
        id:      userName});

    console.log(userName + ' disabled');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userDisable
 * Disable a user in a room, setting them to idle for the moment
 */
io.Listener.prototype.userEnable = function(userName)
{
    var listener = this;
    var time     = new Date().getTime();
    var user     = listener.chatUsers[userName];

    user.connected = true;
    user.tsConnect = time;

    listener.roomBroadcast(user.roomName, {
        type:    'status',
        mode:    'reconnect',
        id:      userName});

    console.log(userName + ' disabled');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userClose
 * Remove user from all lists and rooms, close their connection
 */
io.Listener.prototype.userClose = function(userName)
{
    var listener  = this;
    var client    = listener.client;

    if (userName in listener.chatUsers) {
        var user      = listener.chatUsers[userName];
        var roomName  = user.roomName;
        var sessionId = user.sessionId;

        // Remove from room if it is attached
        listener.roomUserRemove(roomName, userName);

        delete user;

        if (sessionId in listener.clients) {
            // Disconnect user from session
            listener.clients[sessionId]._onClose();
            console.log(userName + ' had session wiped');
        }

        console.log(userName + ' has global account deleted');
    } else {
        console.log(userName + ' had a userClose check');
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userInitRoom
 * Send user all the information about a room
 */
io.Listener.prototype.userInitRoom = function(roomName, client)
{
    var listener = client.listener;

    client.send({
        type:   'approved',
        id:     client.userName,
        room:   roomName,
        topic:  listener.chatRooms[roomName].topic,
        buffer: listener.chatRooms[roomName].buffer,
        users:  listener.roomGetUsers(roomName)});

    console.log(client.userName + ' sent room init');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnConnect
 * Chat Connection for a Client (name, title, url, avatar)
 */

io.Listener.prototype.userOnConnect = function(client)
{
    var listener = this;
    var user     = client.user;
    var roomName = 'main';
    var time     = new Date().getTime();

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup message and disconnect events
    client.on('message', listener.userOnMessage);
    client.on('disconnect', listener.userOnDisconnect);

    try {        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // BANNED USERS
        //
        if (user.name in listener.chatBanned) {            
            client.send({
                type:    'notice',
                message: 'You have been banned.'});
            
            console.log(user.name + ' is banned and attempting to connect');            
            return;
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // GLOBAL MANAGEMENT FOR USER
        //
        if (user.name in listener.chatUsers) {
            // If user is already in list, pull from list
            user = listener.chatUsers[user.name];
        } else {
            // Otherwise initialize additional vars
            user.op           = (user.name in config.chatOps);
            user.roomName     = roomName;
            user.lastMessage  = '';
            user.tsMessage    = 0;
            user.tsDisconnect = 0;
        }

        user.sessionId = client.sessionId;
        user.connected = true;
        user.tsConnect = time;

        // (re)Attach user to the chat users list
        listener.chatUsers[user.name] = user;

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOM MANAGEMENT FOR USER
        //
        for (var otherRoom in listener.chatRooms) {
            listener.chatRoomNotify(otherRoom, user.name)
        }

        // Place into proper room
        listener.roomUserAdd(roomName, user.name);

        // Initialize room and send info on users to client user
        listener.userInitRoom(roomName, client);

        // Broadcast to everyone that listener user has connected
        // This will also add the user to their user list
        listener.roomBroadcast(roomName, {
            type: 'status',
            mode: 'connect',
            id:   user.name,
            user: user});

    } catch(err) {
        listener.userClose(client.userName);
        console.log(err.message);
        console.log(err.stack);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnDisconnect
 * TODO: Handle bad connections, etc
 */
io.Listener.prototype.userOnDisconnect = function()
{
    var client   = this;
    var listener = client.listener;

    listener.userDisable(client.userName);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnMessage
 * Dynamically handle any messages from the user based on a static response type list
 */
io.Listener.prototype.userOnMessage = function(response)
{
    var client   = this;
    var listener = client.listener;

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Server can receive either credentials or a message to share
    //
    if ('type' in response && response.type in listener.chatMessageTypes) {
        listener.chatMessageTypes[response.type](listener, client, response);

        console.log(response.type + ' message from ' + client.userName + ' received');
    } else {
        // Invalid properties sent, disconnect user
        console.log('invalid message sent from ' + client.userName);
    }
}