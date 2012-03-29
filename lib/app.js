var sioaConfig = require('../config/socketioauth')
  , chat       = require('socketioauth')(sioaConfig);
  
module.exports = function(config) {
    console.log('chat initializing');
    
    chat.prototype.config = config;
    
    return new chat();
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Extension variables
//

chat.prototype.__construct = function()
{
    this.chatUsers        = {};
    this.chatUserBlogs    = {};
    this.chatBanned       = {};
    this.chatRooms        = {};
    this.chatOps          = this.config.chatOps;

    this.connect = require('connect');
    this.db      = require('mongojs').connect(this.config.dbUrl, this.config.dbCollections);

    for (var roomName in this.config.chatRooms) {
        // Create each featured room and update list
        this.roomCreate(roomName, true);
    }
}

chat.prototype._init = function(sid)
{   
    // Additional app setup
    var session     = this.__getSession(sid),
        userSession = session.user || null,
        time        = new Date().getTime(),
        user        = {};

    // Kick for corrupt session data
    if (!userSession || !userSession.uid) {
        return this.userSendRestart(sid, 'Unable to retrieve your account.');        
    }

    console.log(userSession.uid);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // GLOBAL MANAGEMENT FOR USER
    //    
    if (userSession.uid in this.chatUsers) {
        // If user is already in list, pull from list
        user = this.chatUsers[userSession.uid];
    } else {
        console.log('user is new');
        // UID is usually their name but we need to start using UID for all mapping
        user.uid    = userSession.uid;
        user.name   = userSession.name   || user.uid;
        user.title  = userSession.title  || user.name;
        user.url    = userSession.url    || null;
        user.avatar = userSession.avatar || null;

        // Otherwise initialize additional vars        
        user.lastMessage  = '';
        user.tsMessage    = time;
        user.tsDisconnect = time;
        user.idle         = false;
    }

    // Regardless, try to determine their OP status
    user.op = (user.name in this.chatOps);

    // Banned Users
    if (!user.op && user.name in this.chatBanned) {
        user.banned   = true;
        user.roomName = this.chatBanned[user.name] || 'banned';
    } else {
        // If not banned, try to put person in the proper room
        user.roomName  = session.page || 'english';
    }

    // Attach current session, set to connected, continue on
    user.sid       = sid;
    user.connected = true;
    user.tsConnect = time;

    // (re)Attach user to the chat users list
    this.chatUsers[user.uid]     = user;
    this.chatUserBlogs[user.uid] = userSession.blogs || null;

    // Place into proper room, initialize room and send info on users to client user
    this.userInitRoom(sid, user.name, user.roomName);
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Generally on a disconnect we merely tag user as disabled and let cleanup remove them
// @see userDisable()
chat.prototype._disconnect = function(sid)
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

chat.prototype._logout = function(sid) {
    this.userClose(this.sockets.sockets[sid].userId, 'You have been logged out.', true);
};

chat.prototype._shout = function(sid, message) 
{
    var user = this.userGetBySid(sid);

    if (user.op) {
        this.__broadcast('status', message);
    }
}

chat.prototype._topic = function(sid, topic)
{
    var user = this.userGetBySid(sid);

    if (user.op) {
        this.chatRooms[user.roomName].topic = topic;
        this.roomBroadcast(roomName, {
            type: 'settopic',
            topic: topic
        });
    }
}

chat.prototype._kick = function(sid, kickUserName, kickRoomName)
{
    var user = this.userGetBySid(sid);

    if (user.op) {
        if (kickUserName in this.chatUsers) {
            var roomName = this.chatUsers[kickUserName].roomName;

            if (kickRoomName) {
                var kickMessage = 'has been kicked to #' + kickRoomName;

                // Create the new room for the user and remove them from old one
                this.userInitRoom(sid, kickUserName, kickRoomName, kickMessage);

            } else {
                this.roomUserRemove(roomName, kickUserName, 'has been kicked...');
                this.userClose(kickUserName, 'You have been kicked from the chat (N2).');
            }
        } 

        return;
    }
}

chat.prototype._banlist = function(sid)
{
    var user = this.userGetBySid(sid);

    if (user.op) {
        this.__send(sid, 'banlist', {list: this.chatBanned});
    }
}

// When users are banned they are basically locked to a specific room
// They can be locked for a duration of time with a reason
//
chat.prototype._ban = function(sid, banUserName, banMinutes, banRoomName, reasonMessage)
{
    var user        = this.userGetBySid(sid),
        time        = new Date().getTime(),
        duration    = -1;

    if (user.op) {
        if (banMinutes && banMinutes == parseInt(banMinutes)) {
            duration = (banMinutes > 0 ? (time + banMinutes * 60000) : -1);
        }

        // Default to the banned room
        banRoomName = this.roomParse(banRoomName || 'banned');

        // Build a fancy message
        var removeMessage = (duration != -1 ? ' for ' + banMinutes + ' minutes' : 'forever')
                + ' to the #' + banRoomName + ' room'
                + (reasonMessage ? ' for ' + reasonMessage : '');

        this.chatBanned[banUserName] = {
            roomName: banRoomName,
            duration: duration
        };

        // Tell everyone they have been banned, with possible time
        this.userInitRoom(sid, banUserName, banRoomName, 'has been banned' + removeMessage + '...');
    }    
}

chat.prototype._unban = function(sid, banUserName)
{
    var user = this.userGetBySid(sid);

    if (user.op) {
        if (banUserName in this.chatBanned) {
            delete this.chatBanned[banUserName];
            user.banned = false;

            // TODO: Update user status so they aren't visually banned
        }
    }
}

chat.prototype._op = function(sid, opUserName, opLevel)
{
    var user = this.userGetBySid(sid);

    opLevel = parseInt(opLevel || 1);

    if (user.op && user.op > opLevel) {
        this.chatOps[opUserName] = opLevel;

        // If user is logged in, go ahead and update their status
        if (opUserName in this.chatUsers) {            
            this.chatUsers[opUserName].op = opLevel;
            // TODO: Push status change out to everyone in that room
        }

    }
}

chat.prototype._deop = function(sid, opUserName)
{
    var user = this.userGetBySid(sid);

    opLevel = parseInt(opLevel || 1);

    if (user.op && opUserName in this.chatOps && user.op > this.chatOps[upUserName]) {
        this.chatOps[opUserName] = '';

        // If user is logged in, go ahead and update their status
        if (opUserName in this.chatUsers) {            
            this.chatUsers[opUserName].op = 0;
            // TODO: Push status change out to everyone in that room
        }
    }

}

chat.prototype._mod = function(sid, modUserName, roomName)
{
    var user = this.userGetBySid(sid);

    if (user.isAdmin && modUserName in this.chatUsers) {
        var modUser     = this.chatUsers[modUserName];
        modUser.isMod   = true;
        modUser.modRoom = roomName;
    }
}

chat.prototype._demod = function(sid, modUserName)
{
    this._mod(sid, modUserName);
}

chat.prototype._away = function(sid)
{
    var user = this.userGetBySid(sid);

    if (!user.idle) {
        user.idle = true;
        this.roomBroadcast(roomName, {
            type: 'away',
            id:   user.name
        });
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// MESSAGE: User is sending a message to everyone
//
chat.prototype._message = function(sid, message) {
    // Get the current room of the user
    var user     = this.userGetBySid(sid),
        roomName = user.roomName || {},
        time     = new Date().getTime();

    // Not idle if sending messages of any kind
    user.idle = false;

    if (roomName) {
        // Limit how long a message can be
        message = message.substr(0, 350);

        // If there is a message and it isn't the same as their last (griefing)
        if (message.length && (user.op || (
            !(user.name in this.chatBanned) && message != user.lastMessage && time - user.tsMessage > 2000))) {

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

            if (!user.op) {
                // Replace repetitive characters
                message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

                // I also hate capslocking
                if (message.search(/[A-Z ]{6,}/) != -1) {
                    message = message.toLowerCase();
                }
            }

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

            // Store last message to track griefing
            user.tsMessage   = time;
            user.lastMessage = message;

            this.roomBufferMessage(roomName, user, message);

            // Broadcast message to everyone
            this.roomBroadcast(roomName, {
                type:    'message',
                id:      user.name,
                message: message});
        }
    }
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// ROOM CHANGE: User is requesting to change this.chatRooms
//
chat.prototype._roomchange = function(sid, roomName) 
{   
    var user = this.userGetBySid(sid);    
    this.userInitRoom(sid, user.name, roomName);
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

chat.prototype.userGetBySid = function(sid) {
    var sessionUser = this.__getSession(sid).user || {},
        userName    = sessionUser.name || null,
        user        = this.chatUsers[userName] || {};

    return user;
}

chat.prototype.roomBufferMessage = function(roomName, user, message)
{
    // Push messages into buffer for user logins
    this.chatRooms[roomName].buffer.push({
        type:    'message',
        user:    user,
        message: message});

    if (this.chatRooms[roomName].buffer.length > 15) {
        this.chatRooms[roomName].buffer.shift();
    }    
}

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

            this.__sendAll('roomchange', {
                roomName:  roomName,
                roomCount: room.userCount,
                roomFeatured: room.featured                
            });
        }
    } else {
        // Room doesn't exist and needs to be removed
        this.__sendAll('roomdelete', {
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
                var sid = this.chatUsers[userName].sid;

                if (this.sockets.sockets[sid]) {
                    var method = object.type;
                    this.__send(sid, method, object);
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
    // TODO: Fix how private rooms works
    // 
    // Sanitize roomnames before creating them
    roomName = this.roomParse(roomName);   

    // If Room does not exist, CREATE IT
    this.chatRooms[roomName] = {
        topic:     '',
        buffer:    [],
        users:     {},
        userCount: 0,
        featured:  featured,
        hidden:    (roomName.substr(0, 1) == '!')};

    // Save to database
    this.db.room.save(this.connect.utils.merge(
        {name: roomName}, 
        this.chatRooms[roomName]
    ), {}, true, true, function(dbErr, dbRoom) {
        if (dbErr || !dbRoom) {
            console.log('Room ' + dbRoom.name + ' not saved');
        } else {
            console.log('Room ' + dbRoom.name + ' saved');
        }
    });

   console.log(roomName + ' created.');
}

chat.prototype.roomParse = function(roomName) 
{
    return roomName.toLowerCase().replace(/[^a-z0-9]+/ig, '-'); 
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
chat.prototype.roomUserAdd = function(roomName, userName, removeMessage)
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
                this.roomUserRemove(otherRoomName, userName, removeMessage);
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
chat.prototype.userInitRoom = function(sid, userName, roomName, removeMessage)
{
    // Add user to the room (always happen on init)
    // This will also remove user from other rooms if necessary
    this.roomUserAdd(roomName, userName, removeMessage);

    var rooms     = this.chatGetRooms();
    var roomUsers = this.roomGetUsers(roomName);

    // Send out a welcome packet to user with all the relevant information
    this.__send(sid, 'approved', {
        id:       userName,
        roomName: roomName,
        topic:    this.chatRooms[roomName].topic,
        buffer:   this.chatRooms[roomName].buffer,
        rooms:    rooms,
        users:    roomUsers,
        blogs:    this.chatUserBlogs[userName]
    });

    // console.log(client.userName + ' sent room init');
}

chat.prototype.userSendRestart = function(sid, message)
{
    console.log('restarting ' + message);

    this.__send(sid, 'restart', message);
    return false;
}

chat.prototype.userSendLogout = function(client)
{
    console.log('logging out');

    client.send({
        type: 'logout'
    });

    return false;
}
