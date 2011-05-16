// // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
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
io.Listener.prototype.store            = null;

io.Listener.prototype.setStore = function(store) {
    this.store = store;
}

io.Listener.prototype.getStore = function() {
    return this.store;
}

io.Listener.prototype.chatMessageTypes = {
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // INITIALIZE: user is initializing with session id and room
    //
    init: function(listener, client, response) {
        // We now wait for user to send session ID, then hack into connection
        if (!response.sid) {
            return listener.userSendRestart(client, 'We cannot detect your session ID (E1).');            
        }        
        
        // Session ID can have spaces, so convert back
        response.sid = unescape(response.sid);

        if (!('request' in client)) {
            return listener.userSendRestart(client, 'We cannot detect your request (E4).');
        }

        var sessionStore = listener.getStore();
        
        if (!sessionStore) {
            return listener.userSendRestart(client, 'We cannot detect your session store (E5).');
        }

        var session = sessionStore.sessions[response.sid] || null;
        session = JSON.parse(session);

        if (!session || !session.user) {
            return listener.userSendRestart(client, 'We cannot detect your session (E2).');
        }

        // Attach the user name to the client
        // TODO: Otherway around, attach clientID to user table to avoid editing client object
        client.userName = session.user.name;

        // Back to our normal programming
        var user     = session.user;
        var time     = new Date().getTime();

        // Banned Users
        if (user.name in listener.chatBanned) {
            return listener.userSendRestart(client, 'You have been banned (N1).');
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
            user.lastMessage  = '';
            user.tsMessage    = time;
            user.tsDisconnect = time;
            user.idle         = false;
        }

        console.log('init ' + user.name);
        
        // Setup core paramters as connected
        user.roomName  = user.roomName || response.roomName || 'english';
        user.sessionId = client.sessionId;
        user.connected = true;
        user.tsConnect = time;

        // (re)Attach user to the chat users list
        listener.chatUsers[user.name] = user;

        // Place into proper room, initialize room and send info on users to client user
        listener.userInitRoom(user.roomName, client);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // MESSAGE: User is sending a message to everyone
    //
    message: function(listener, client, response) {
        if ('message' in response && typeof response.message == 'string') {
            // Get the current room of the user
            var user     = listener.chatUsers[client.userName];
            var roomName = user.roomName;

            // Not idle if sending messages of any kind
            user.idle = false;

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
                            type:    'status',
                            message: shoutMessage});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Set the Topic
                    //
                    } else if (message.search(/^\/topic/) == 0) {
                        var topic = message.substr(7);
                        listener.chatRooms[roomName].topic = topic;
                        listener.roomBroadcast(roomName, {
                            type:  'settopic',
                            topic: topic});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Kick User Out or to Another Room
                    //
                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                        var kickSplit = message.split(' ');
                        var kickName  = (1 in kickSplit ? kickSplit[1] : false);

                        if (kickName in listener.chatUsers) {
                            var kickUser   = listener.chatUsers[kickName];
                            var kickRoom   = (2 in kickSplit ? kickSplit[2] : false);
                            var kickSessid = kickUser.sessionId;
                            var kickClient = listener.clients[kickSessid];

                            if (kickRoom) {

                                listener.userInitRoom(kickRoom, kickClient);

                                // Let everyone know that someone has been moved
                                listener.roomUserRemove(roomName, kickName, 'has been kicked to #' + kickRoom);
                            } else {
                                listener.roomUserRemove(roomName, kickName, 'has been kicked...');
                                listener.userClose(kickName, 'You have been kicked from the chat (N2).');
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
                        var banName  = (1 in banSplit ? banSplit[1] : false);

                        if (banName in listener.chatBanned) {
                            delete listener.chatBanned[banName];
                        } else {
                            // Duration in milliseconds
                            var duration    = (2 in banSplit ? (time + parseInt(banSplit[2]) * 60000) : -1);
                            var durationMsg = (duration != -1 ? ' for ' + banSplit[2] + ' minutes' : '');
                            listener.chatBanned[banName] = duration;

                            // Tell everyone they have been banned, with possible time
                            listener.roomUserRemove(roomName, banName, 'has been banned' + durationMsg + '...');
                            listener.userClose(banName, 'You have been banned ' + durationMsg + ' (N3).');                            
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
                        user.idle = true;
                        listener.roomBroadcast(roomName, {
                            type: 'away',
                            id:   user.name
                        });

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
    roomchange: function(listener, client, response) {        
        if ('room' in response && response.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
            // standardize room for a link
            var roomName = response.room.toLowerCase();
            listener.userInitRoom(roomName, client);
        } else {
            return listener.userSendRestart(client, 'Unable to change rooms (E3).');
        }
    }
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatCleanup
 * Perform garbage cleanup of rogue users
 *
 * @see userClose()
 * @see userDisable()
 * @see roomUserAdd()
 */
io.Listener.prototype.chatCleanup = function(listener) {
    try {
        var time = new Date().getTime();

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // USER CLEANUP
        //
        for (var userName in listener.chatUsers) {
            var user      = listener.chatUsers[userName];

            if (!user.connected) {
                // If user has been disconnected longer than allowed, drop completely
                if (time - user.tsDisconnect > config.interval) {
                    listener.userClose(userName, 'You were disconnected for too long (C1).');
                }
            } else if (!(user.roomName in listener.chatRooms) || !(userName in listener.chatRooms[user.roomName].users)) {
                // RARE user says in room X which doen'st exist or not in room
                listener.roomUserAdd('english', userName);
            } else {
                // Detect idle users and set them to away
                if (!user.idle && time - user.tsMessage > config.intIdle) {
                    user.idle = true;
                    listener.roomBroadcast(user.roomName, {
                        type: 'away',
                        id:   userName
                    });
                }

                // Kick users who squat in chat (not OP of course)
                if (user.idle && !user.op && time - user.tsMessage > config.intKick) {
                    listener.userClose(userName, 'You were idle for too long (C2).');
                }
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
                    listener.userClose(userName, 'We cannot find you in global list (C3).');
                } else {
                    room.userCount++;
                }
            }

            if (!room.userCount && !room.featured) {
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

                // console.log(banName + ' has been unbanned');
            }
        }

        // console.log('cleanup run');
    } catch(err) {
        console.log(err.message);
        console.log(err.stack);
    }
}

io.Listener.prototype.chatGetRooms = function()
{
    var listener = this;
    var rooms = {};

    for (var i in listener.chatRooms) {
        rooms[i] = {
            roomCount: listener.chatRooms[i].userCount,
            roomFeatured: listener.chatRooms[i].featured
        };
    }

    return rooms;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatInit
 * Initialize Chatroom: Setup rooms and timers
 *
 * @see roomCreate()
 * @see chatCleanup()
 */
io.Listener.prototype.chatInit = function()
{
    try {
        var listener = this;

        for (var roomName in config.chatRooms) {
            // Create each featured room and update list
            listener.roomCreate(roomName, true);
        }

        // Perform memory cleanup on everything
        setInterval(function() {listener.chatCleanup(listener);}, config.interval);
    } catch(err) {
        console.log(err.message);
        console.log(err.stack);
    }
}


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatRoomNotify
 * Notify EVERYONE of room additions / removals / user changes
 *
 * @see send()
 * @see broadcast()
 */
io.Listener.prototype.chatRoomNotify = function(roomName)
{
    var listener = this;

    if (roomName in listener.chatRooms) {
        // Room is either new or has user changes, notify
        var room = listener.chatRooms[roomName];

        if (!room.hidden) {
            console.log(room.featured);
            
            listener.broadcast({
                type:      'roomchange',
                roomName:  roomName,
                roomCount: room.userCount,
                roomFeatured: room.featured
            });
        }
    } else {
        // Room doesn't exist and needs to be removed
        listener.broadcast({
            type:      'roomdelete',
            roomName:  roomName
        });
    }

    // console.log('notifying room change for ' + roomName);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomBroadcast
 * Broadcast a message to a room
 *
 * @see send()
 * @see userDisable()
 */
io.Listener.prototype.roomBroadcast = function(roomName, object, excludeName)
{
    var listener = this;

    for (var userName in listener.chatRooms[roomName].users) {
        if (userName != excludeName) {
            // We want to avoid infinite loops from userDisable() sending a broadcast
            if (userName in listener.chatUsers) {
                var sessionId = listener.chatUsers[userName].sessionId;

                if (sessionId in listener.clients) {
                    // Send to each client in the room
                    listener.clients[sessionId].send(object);
                }
            } else {
                // User name isn't in global list, shouldn't be in room either
                listener.roomUserRemove(userName);
            }
        }
    }

    // console.log('broadcasting to ' + roomName);
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

    // console.log(roomName + ' created.');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomDestroy
 * Delete a room (can even destroy featured rooms)
 *
 * @see chatRoomNotify()
 */
io.Listener.prototype.roomDestroy = function(roomName)
{
    var listener = this;

    // Remove room from list and notify
    delete listener.chatRooms[roomName];
    listener.chatRoomNotify(roomName);

    // console.log(roomName + ' removed');
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
        var user = listener.chatUsers[userName];
        output[userName] = {
            name: user.name,
            title: user.title,
            url: user.url,
            avatar: user.avatar,
            op: user.op,
            idle: user.idle
        };
    }

    
    
    // console.log('getting room users');
    
    return output;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomUserAdd
 * Add a user to a room
 * If room does not exist, create it and remove user from other possible rooms
 * If room does exist and user does not exist, add user and inform others
 * If room does exist and user does exist, do nothing
 *
 * @see roomCreate()
 * @see roomBroadcast()
 * @see chatRoomNotify()
 * @see roomUserRemove()
 * @see userEnable()
 */
io.Listener.prototype.roomUserAdd = function(roomName, userName)
{
    var listener = this;

    // Check that the room is actually in the list
    if (!(roomName in listener.chatRooms)) {
        // If not, let's create it
        listener.roomCreate(roomName);
    }

    var room = listener.chatRooms[roomName];
    var time = new Date().getTime();

    // Check if user is in room
    if (!(userName in room.users)) {
        // USER IS NEW: add them and notify other users
        room.users[userName] = time;
        room.userCount++;

        // Update user reference
        listener.chatUsers[userName].roomName = roomName;

        // Broadcast to the room of the new user
        listener.roomBroadcast(roomName, {
            type: 'connected',
            user: listener.chatUsers[userName]
        }, userName);

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

        // console.log(userName + ' added to room ' + roomName);
    } else {
        // Show user as active again from reconnect (or for first time)
        listener.userEnable(userName);

        // console.log(userName + ' reconnected to ' + roomName);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomUserRemove
 * Remove a user from a room
 *
 * @see roomDestroy()
 * @see roomBroadcast()
 * @see chatRoomNotify()
 */
io.Listener.prototype.roomUserRemove = function(roomName, userName, message)
{
    var listener = this;

    // NOTE: It is possible that room was torn down when user was removed
    if (roomName in listener.chatRooms) {
        var room = listener.chatRooms[roomName];

        // Check that user is actually in the room
        if (userName in room.users) {
            delete listener.chatRooms[roomName].users[userName];
            room.userCount--;

            if (!room.featured && room.userCount <= 0) {
                // Get rid of this room
                listener.roomDestroy(roomName);
            } else {
                if (message) {
                    // Broadcast a kick/ban/idle
                    listener.roomBroadcast(roomName, {
                        type:    'kicked',
                        id:      userName,
                        message: message
                    }, userName);
                } else {
                    // Broadcast a straight up disconnect
                    listener.roomBroadcast(roomName, {
                        type: 'disconnected',
                        id:   userName
                    }, userName);
                }

                // Notify room count changes
                listener.chatRoomNotify(roomName);
            }

            // console.log(userName + ' removed from room ' + roomName);
        } else {
            // console.log(userName + ' already removed from ' + roomName);
        }
    } else if (userName in listener.chatUsers) {
        if (listener.chatUsers[userName].roomName == roomName) {
            listener.chatUsers[userName].roomName = 'english';
        }
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userEnable
 * Enable a user in a room, setting them to idle for the moment
 *
 * @see roomBroadcast()
 */
io.Listener.prototype.userEnable = function(userName)
{
    var listener = this;
    var time     = new Date().getTime();

    if (userName in listener.chatUsers) {
        var user = listener.chatUsers[userName];

        console.log('enabling ' + userName);
        // Set user as connected
        user.connected = true;
        user.tsConnect = time;

        // Let everyone know they are back!
        listener.roomBroadcast(user.roomName, {
            type: 'reconnected',
            id:   userName});

        // console.log(userName + ' enabled');
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userClose
 * Remove user from all lists and rooms (does not close socket connection)
 *
 * @see roomUserRemove()
 */
io.Listener.prototype.userClose = function(userName, message)
{
    var listener  = this;

    if (userName in listener.chatUsers) {
        var user      = listener.chatUsers[userName];
        var roomName  = user.roomName;
        var sessionId = user.sessionId;

        // Remove from room if it is attached
        listener.roomUserRemove(roomName, userName);

        // Remove user from global list
        delete listener.chatUsers[userName];

        // Send a close message if possible
        if (message && sessionId in listener.clients) {
            var client = listener.clients[sessionId];
            listener.userSendRestart(client, message);
        }

        // console.log(userName + ' has global account deleted');
    } else {
        // console.log(userName + ' had a userClose check');
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userInitRoom
 * Send user all the information about a room
 *
 * @see roomUserAdd()
 * @see chatGetRooms()
 * @see roomGetUsers()
 * @see send()
 */
io.Listener.prototype.userInitRoom = function(roomName, client)
{
    var listener  = client.listener;
    
    // Add user to the room (always happen on init)
    // This will also remove user from other rooms if necessary
    listener.roomUserAdd(roomName, client.userName);

    var rooms     = listener.chatGetRooms();
    var roomUsers = listener.roomGetUsers(roomName);

    // Send out a welcome packet to user with all the relevant information
    client.send({
        type:     'approved',
        id:       client.userName,
        roomName: roomName,
        topic:    listener.chatRooms[roomName].topic,
        buffer:   listener.chatRooms[roomName].buffer,
        rooms:    rooms,
        users:    roomUsers
    });

    // console.log(client.userName + ' sent room init');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnDisconnect
 * Generally on a disconnect we merely tag user as disabled and let cleanup remove them
 *
 * @see userDisable()
 */
io.Listener.prototype.userOnDisconnect = function()
{
    try {
        var client   = this;
        var listener = client.listener;
        var time     = new Date().getTime();

        // If user is setup once before
        if ('userName' in client) {
            var userName = client.userName;

            // And they are in the list of chat users
            if (userName in listener.chatUsers) {
                var user = listener.chatUsers[userName];

                if (client.sessionId == user.sessionId) {
                    // If user is connected, set disconnect and time, inform others of away status
                    user.connected    = false;
                    user.tsDisconnect = time;
                } else {
                    console.log('invalid session to client pair (polling)');
                }
            }
        }

        // console.log(client.userName + ' disconnected');
    } catch (err) {
        console.log(err.message);
        console.log(err.stack);
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnMessage
 * Dynamically handle any messages from the user based on a static response type list
 *
 * @see chatMessageTypes
 */
io.Listener.prototype.userOnMessage = function(response)
{
    try {
        var client   = this;
        var listener = client.listener;

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Server can receive either credentials or a message to share
        //
        if ('type' in response && response.type in listener.chatMessageTypes) {
            if (response.type == 'init' || (client.userName && client.userName in listener.chatUsers)) {
                listener.chatMessageTypes[response.type](listener, client, response);
                // console.log(response.type + ' message from ' + client.userName + ' received');
            } else {
                // console.log('invalid message order, no username set to client');
            }
        } else {
            // Invalid properties sent, disconnect user
            // console.log('invalid message sent from ' + client.userName);
        }
    } catch (err) {
        console.log(err.message);
        console.log(err.stack);
    }
}

io.Listener.prototype.userSendRestart = function(client, message)
{
    client.send({
        type:    'restart',
        message: message
    });

    console.log(client.sessionId + ' ' + message);
    
    return false;
}
