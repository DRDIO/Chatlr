// // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Extension variables
//

/**
 * constructor
 * Initialize Chatroom: Setup rooms and timers
 *
 * @see roomCreate()
 * @see chatCleanup()
 */
function chat (io, config) {
    this.io     = io;
    this.config = config;
    this.socket = null;
    
    this.chatUsers        = {};
    this.chatUserBlogs    = {};
    this.chatBanned       = {};
    this.chatRooms        = {}; 
    
    for (var roomName in this.config.chatRooms) {
        // Create each featured room and update list
        this.roomCreate(roomName, true);
    }

    // Perform memory cleanup on everything
//    var chat = this;
//    setInterval(function() {
//        chat.chatCleanup();
//    }, this.config.interval);
}

chat.prototype.setupEvents = function(socket)
{
    this.socket = socket;
    socket.chat = this;

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup message and disconnect events
    socket.on('init', this.socketInit);
    socket.on('message', this.userOnMessage);
    socket.on('disconnect', this.socketDisconnect);    
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// INITIALIZE: user is initializing with session id and room
// Scope is attached to socket
//
chat.prototype.socketInit = function(data)
{
    var chat    = this.chat,
        session = this.handshake.session || null;

    if (!session || !session.user) {
        return chat.userSendRestart(this, 'We cannot detect your session (E2).');
    }

    // Attach the user name to the client
    // TODO: Otherway around, attach clientID to user table to avoid editing client object
    this.userName = session.user.name;

    // Back to our normal programming
    var user     = session.user;
    var time     = new Date().getTime();

    // Banned Users
    if (user.name in chat.chatBanned) {
        return chat.userSendRestart(this, 'You have been banned (N1).');
    }

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // GLOBAL MANAGEMENT FOR USER
    //
    if (user.name in chat.chatUsers) {
        // If user is already in list, pull from list
        user = chat.chatUsers[user.name];
    } else {
        // Otherwise initialize additional vars
        user.op           = (user.name in chat.config.chatOps);
        user.lastMessage  = '';
        user.tsMessage    = time;
        user.tsDisconnect = time;
        user.idle         = false;
    }

    console.log('init ' + user.name);

    // Setup core paramters as connected
    user.roomName  = user.roomName || data.roomName || 'english';
    user.sessionId = this.sessionId;
    user.connected = true;
    user.tsConnect = time;

    // (re)Attach user to the chat users list
    chat.chatUsers[user.name]     = user;
    chat.chatUserBlogs[user.name] = session.user.blogs;

    // Place into proper room, initialize room and send info on users to client user
    chat.userInitRoom(user.roomName, this);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Generally on a disconnect we merely tag user as disabled and let cleanup remove them
// @see userDisable()
chat.prototype.socketDisconnect = function()
{
    var chat = this.chat,
        time = new Date().getTime();
    
    // If user is setup once before
    if ('userName' in this) {
        var userName = this.userName;

        // And they are in the list of chat users
        if (userName in chat.chatUsers) {
            var user = chat.chatUsers[userName];

            if (this.sid == user.sessionId) {
                // If user is connected, set disconnect and time, inform others of away status
                user.connected    = false;
                user.tsDisconnect = time;
            } else {
                console.log('invalid session to client pair (polling)');
            }
        }
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Room and Banned User Vars
//

chat.prototype.chatMessageTypes = {
    logout: function(listener, client, response) {
        this.userClose(client.userName, 'You have been logged out.', true);
    },
   
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // MESSAGE: User is sending a message to everyone
    //
    message: function(listener, client, response) {
        if ('message' in response && typeof response.message == 'string') {
            // Get the current room of the user
            var user     = this.chatUsers[client.userName];
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
                        this.broadcast({
                            type:    'status',
                            message: shoutMessage});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Set the Topic
                    //
                    } else if (message.search(/^\/topic/) == 0) {
                        var topic = message.substr(7);
                        this.chatRooms[roomName].topic = topic;
                        this.roomBroadcast(roomName, {
                            type:  'settopic',
                            topic: topic});
                        return;

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Kick User Out or to Another Room
                    //
                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                        var kickSplit = message.split(' ');
                        var kickName  = (1 in kickSplit ? kickSplit[1] : false);

                        if (kickName in this.chatUsers) {
                            var kickUser   = this.chatUsers[kickName];
                            var kickRoom   = (2 in kickSplit ? kickSplit[2] : false);
                            var kickSessid = kickUser.sessionId;
                            var kickClient = this.clients[kickSessid];

                            if (kickRoom) {

                                this.userInitRoom(kickRoom, kickClient);

                                // Let everyone know that someone has been moved
                                this.roomUserRemove(roomName, kickName, 'has been kicked to #' + kickRoom);
                            } else {
                                this.roomUserRemove(roomName, kickName, 'has been kicked...');
                                this.userClose(kickName, 'You have been kicked from the chat (N2).');
                            }
                        } 

                        return;

                    } else if (message.search(/^\/banlist/i) === 0) {
                        
                        return;
                        
                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                    // OP: Ban User For X Time
                    //
                    } else if (message.search(/^\/ban [a-z0-9-]+( \d+)/i) == 0) {
                        // Get the name and duration of ban in minutes
                        // If duration is blank, set the ban to infinity
                        var banSplit = message.split(' ');
                        var banName  = (1 in banSplit ? banSplit[1] : false);

                        if (banName in this.chatBanned) {
                            delete this.chatBanned[banName];
                        } else {
                            // Duration in milliseconds
                            var duration    = (2 in banSplit ? (time + parseInt(banSplit[2]) * 60000) : -1);
                            var durationMsg = (duration != -1 ? ' for ' + banSplit[2] + ' minutes' : '');
                            this.chatBanned[banName] = duration;

                            // Tell everyone they have been banned, with possible time
                            this.roomUserRemove(roomName, banName, 'has been banned' + durationMsg + '...');
                            this.userClose(banName, 'You have been banned ' + durationMsg + ' (N3).');                            
                        }
                        return;
                    }
                }

                // If there is a message and it isn't the same as their last (griefing)
                if (message.length > 0 && (user.op || (
                        !(user.name in this.chatBanned) &&
                        message != user.lastMessage &&
                        time - user.tsMessage > 2000))) {

                    if (message.search(/^\/away/) == 0) {
                        user.idle = true;
                        this.roomBroadcast(roomName, {
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
                    this.chatRooms[roomName].buffer.push({
                        type:    'message',
                        user:    user,
                        message: message});

                    if (this.chatRooms[roomName].buffer.length > 15) {
                        this.chatRooms[roomName].buffer.shift();
                    }

                    // Broadcast message to everyone
                    this.roomBroadcast(roomName, {
                        type:    'message',
                        id:      user.name,
                        message: message});
                }
            }
        }
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // ROOM CHANGE: User is requesting to change this.chatRooms
    //
    roomchange: function(listener, client, response) {        
        if ('room' in response && response.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
            // standardize room for a link
            var roomName = response.room.toLowerCase();
            this.userInitRoom(roomName, client);
        } else {
            return this.userSendRestart(client, 'Unable to change rooms (E3).');
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
chat.prototype.chatCleanup = function() {
    try {
        var time = new Date().getTime();

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // USER CLEANUP
        //
        for (var userName in this.chatUsers) {
            var user      = this.chatUsers[userName];

            if (!user.connected) {
                // If user has been disconnected longer than allowed, drop completely
                if (time - user.tsDisconnect > this.config.interval) {
                    this.userClose(userName, 'You were disconnected for too long (C1).');
                }
            } else if (!(user.roomName in this.chatRooms) || !(userName in this.chatRooms[user.roomName].users)) {
                // RARE user says in room X which doen'st exist or not in room
                this.roomUserAdd('english', userName);
            } else {
                // Detect idle users and set them to away
                if (!user.idle && time - user.tsMessage > this.config.intIdle) {
                    user.idle = true;
                    this.roomBroadcast(user.roomName, {
                        type: 'away',
                        id:   userName
                    });
                }

                // Kick users who squat in chat (not OP of course)
                if (user.idle && !user.op && time - user.tsMessage > this.config.intKick) {
                    this.userClose(userName, 'You were idle for too long (C2).');
                }
            }
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOM CLEANUP
        //
        for (var roomName in this.chatRooms) {
            var room      = this.chatRooms[roomName];
            var userCount = room.userCount;

            // Reset user count and recalculate
            room.userCount = 0;

            for (userName in room.users) {
                if (!(userName in this.chatUsers)) {
                    // User is in room list but not global, delete
                    this.userClose(userName, 'We cannot find you in global list (C3).');
                } else {
                    room.userCount++;
                }
            }

            if (!room.userCount && !room.featured) {
                // Remove room from list
                this.roomDestroy(roomName);
            } else if (userCount != room.userCount) {
                // Count somehow got off, so update clients with change
                this.chatRoomNotify(roomName);
            }
        }

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // BAN LIST CLEANUP
        //
        for (var banName in this.chatBanned) {
            if (this.chatBanned[banName] != -1 && this.chatBanned[banName] < time) {
                delete this.chatBanned[banName];

                // console.log(banName + ' has been unbanned');
            }
        }

        // console.log('cleanup run');
    } catch(err) {
        console.log(err.message);
        console.log(err.stack);
    }
}

chat.prototype.chatGetRooms = function()
{
    
    var rooms = {};

    for (var i in this.chatRooms) {
        rooms[i] = {
            roomCount: this.chatRooms[i].userCount,
            roomFeatured: this.chatRooms[i].featured
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

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * chatRoomNotify
 * Notify EVERYONE of room additions / removals / user changes
 *
 * @see send()
 * @see broadcast()
 */
chat.prototype.chatRoomNotify = function(roomName)
{
    if (roomName in this.chatRooms) {
        // Room is either new or has user changes, notify
        var room = this.chatRooms[roomName];

        if (!room.hidden) {
            // console.log(room.featured);
            
            this.socket.broadcast.send({
                type:      'roomchange',
                roomName:  roomName,
                roomCount: room.userCount,
                roomFeatured: room.featured
            });
        }
    } else {
        // Room doesn't exist and needs to be removed
        this.socket.broadcast.send({
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
chat.prototype.roomBroadcast = function(roomName, object, excludeName)
{   
    for (var userName in this.chatRooms[roomName].users) {
        if (userName != excludeName) {
            // We want to avoid infinite loops from userDisable() sending a broadcast
            if (userName in this.chatUsers) {
                var sessionId = this.chatUsers[userName].sessionId;

                if (sessionId in this.clients) {
                    // Send to each client in the room
                    this.clients[sessionId].send(object);
                }
            } else {
                // User name isn't in global list, shouldn't be in room either
                this.roomUserRemove(userName);
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
chat.prototype.roomCreate = function(roomName, featured)
{
    // If Room does not exist, CREATE IT
    this.chatRooms[roomName] = {
        topic:     'Anything',
        buffer:    [],
        users:     {},
        userCount: 0,
        featured:  featured,
        hidden:    (roomName.substr(0, 1) == '!')};

   console.log(roomName + ' created.');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomDestroy
 * Delete a room (can even destroy featured rooms)
 *
 * @see chatRoomNotify()
 */
chat.prototype.roomDestroy = function(roomName)
{
    

    // Remove room from list and notify
    delete this.chatRooms[roomName];
    this.chatRoomNotify(roomName);

    // console.log(roomName + ' removed');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * roomGetUsers
 * Get full user data as an array
 */
chat.prototype.roomGetUsers = function(roomName)
{
    
    var output   = {};

    for (var userName in this.chatRooms[roomName].users) {
        var user = this.chatUsers[userName];
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
chat.prototype.roomUserAdd = function(roomName, userName)
{
    

    // Check that the room is actually in the list
    if (!(roomName in this.chatRooms)) {
        // If not, let's create it
        this.roomCreate(roomName);
    }

    var room = this.chatRooms[roomName];
    var time = new Date().getTime();

    // Check if user is in room
    if (!(userName in room.users)) {
        // USER IS NEW: add them and notify other users
        room.users[userName] = time;
        room.userCount++;

        // Update user reference
        this.chatUsers[userName].roomName = roomName;

        // Broadcast to the room of the new user
        this.roomBroadcast(roomName, {
            type: 'connected',
            user: this.chatUsers[userName]
        }, userName);

        // Broadcast to everyone the room count change
        this.chatRoomNotify(roomName);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Make sure user is removed from other rooms
        //
        for (var otherRoomName in this.chatRooms) {
            if (otherRoomName != roomName) {
                this.roomUserRemove(otherRoomName, userName);
            }
        }

        // console.log(userName + ' added to room ' + roomName);
    } else {
        // Show user as active again from reconnect (or for first time)
        this.userEnable(userName);

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
chat.prototype.roomUserRemove = function(roomName, userName, message)
{
    

    // NOTE: It is possible that room was torn down when user was removed
    if (roomName in this.chatRooms) {
        var room = this.chatRooms[roomName];

        // Check that user is actually in the room
        if (userName in room.users) {
            delete this.chatRooms[roomName].users[userName];
            room.userCount--;

            if (!room.featured && room.userCount <= 0) {
                // Get rid of this room
                this.roomDestroy(roomName);
            } else {
                if (message) {
                    // Broadcast a kick/ban/idle
                    this.roomBroadcast(roomName, {
                        type:    'kicked',
                        id:      userName,
                        message: message
                    }, userName);
                } else {
                    // Broadcast a straight up disconnect
                    this.roomBroadcast(roomName, {
                        type: 'disconnected',
                        id:   userName
                    }, userName);
                }

                // Notify room count changes
                this.chatRoomNotify(roomName);
            }

            // console.log(userName + ' removed from room ' + roomName);
        } else {
            // console.log(userName + ' already removed from ' + roomName);
        }
    } else if (userName in this.chatUsers) {
        if (this.chatUsers[userName].roomName == roomName) {
            this.chatUsers[userName].roomName = 'english';
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
chat.prototype.userEnable = function(userName)
{
    
    var time     = new Date().getTime();

    if (userName in this.chatUsers) {
        var user = this.chatUsers[userName];

        // console.log('enabling ' + userName);
        // Set user as connected
        user.connected = true;
        user.tsConnect = time;

        // Let everyone know they are back!
        this.roomBroadcast(user.roomName, {
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
chat.prototype.userClose = function(userName, message, logout)
{
    var listener  = this;

    if (userName in this.chatUsers) {
        var user      = this.chatUsers[userName];
        var roomName  = user.roomName;
        var sessionId = user.sessionId;

        // Remove from room if it is attached
        this.roomUserRemove(roomName, userName);

        // Remove user from global list
        delete this.chatUsers[userName];
        delete this.chatUserBlogs[userName];
        
        // Send a close message if possible
        if (message && sessionId in this.clients) {
            var client = this.clients[sessionId];
            if (logout) {
                this.userSendLogout(client);
            } else {
                this.userSendRestart(client, message);
            }
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
chat.prototype.userInitRoom = function(roomName, client)
{
    var listener  = client.listener;
    
    // Add user to the room (always happen on init)
    // This will also remove user from other rooms if necessary
    this.roomUserAdd(roomName, client.userName);

    var rooms     = this.chatGetRooms();
    var roomUsers = this.roomGetUsers(roomName);

    // Send out a welcome packet to user with all the relevant information
    client.send({
        type:     'approved',
        id:       client.userName,
        roomName: roomName,
        topic:    this.chatRooms[roomName].topic,
        buffer:   this.chatRooms[roomName].buffer,
        rooms:    rooms,
        users:    roomUsers,
        blogs:    this.chatUserBlogs[client.userName]
    });

    // console.log(client.userName + ' sent room init');
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * userOnMessage
 * Dynamically handle any messages from the user based on a static response type list
 *
 * @see chatMessageTypes
 */
chat.prototype.userOnMessage = function(response)
{    
    // The scope is the socket with a circular reference to chat
    
    try {        
        var client   = this;
        var chat     = this.chat;
        var listener = null;

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Server can receive either credentials or a message to share
        //
        if ('type' in response && response.type in chat.chatMessageTypes) {
            if (response.type == 'init' || (client.userName && client.userName in chat.chatUsers)) {
                chat.chatMessageTypes[response.type](listener, client, response);
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

chat.prototype.userSendRestart = function(client, message)
{
    client.send({
        type:    'restart',
        message: message
    });

    console.log(client.sessionId + ' ' + message);
    
    return false;
}

chat.prototype.userSendLogout = function(client)
{
    client.send({
        type: 'logout'
    });
    
    return false;
}

module.exports = function(socket, config) {
    return new chat(socket, config);
};
