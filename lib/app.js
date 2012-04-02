// process.on('uncaughtException', function (exception) {
//     console.log(exception.type);
//     console.log(exception.message);
// });

var _        = require('underscore'),
    Boiler   = require('./boiler');

module.exports = Boiler.extend({
    
    // Occurs onConnect from socket
    // @see boiler.js
    initClient: function(user, roomName)
    {                
        console.log('calling init client app.js');
        
        // Check with user list and update user status
        this.userList.isUserOp(user);
        
        // Check if user is banned and get a room name if so
        roomName = this.userList.isUserBanned(user) || roomName;

        // Verify that room and user exist (create room if not)
        var room = this.roomList.isRoom(roomName, true);

        console.log(room);
        this.initRoomUser(user, room);
    },
    
    filterMessage: function(message)
    {
        // Replace repetitive characters
        message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

        // I also hate capslocking
        if (message.search(/[A-Z ]{6,}/) != -1) {
            message = message.toLowerCase();
        }

        return message;
    },
    
    isMessageAllowed: function(user, message) {
        var time = new Date().getTime();
        
        return message.length && (user.isOp() || (
            !user.isBanned() && message != user.lastMessage && time - user.tsMessage > 2000))
    },
    
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// ALL SOCKET METHODS ARE PREFIXED WITH get
// @see boiler.js

    getMessage: function(user, message) 
    {
        console.log('retrieving message for ' + user.name);
        
        var room = user.isRoom();

        // Not idle if sending messages of any kind
        user.isIdle(false);

        // Limit how long a message can be
        message = message.substr(0, 350);

        // If there is a message and it isn't the same as their last (griefing)
        if (this.isMessageAllowed(user, message)) {
            if (!user.isOp()) {
                message = this.filterMessage(message);
            }

            // Store last message for later
            user.isLastMessage(message);            
            room.bufferMessage(user, message);
            
            console.log('broadcasting message');
            
            this.broadcastRoom('message', {
                type:    'message',
                id:      user.isUid(),
                message: message
            }, room);
        }
    },
    
    getRoomchange: function(user, roomName)
    {
        var room = this.roomList.isRoom(roomName, true);
        
        this.initRoomUser(user, room);
    },
    
    getLogout: function(user)
    {
        this.removeUser(user);
    },
    
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    initRoomUser: function(user, room)
    {
        console.log('calling init room user for ' + user.uid + ' and ' + room.name);
        
        // Add user to the room (always happen on init)
        // This will also remove user from other rooms if necessary
        this.addRoomUser(user, room);   
        
        // Send out a welcome packet to user with all the relevant information
        this.messageUser('approved', {
            id:           user.isUid(),
            roomName:     room.name,
            roomList:     this.roomList.getList(true, true, room),
            roomUserList: room.getUserList(true),
            topic:        room.topic,
            buffer:       room.buffer,
            userBlogList: user.getBlogList()  
        }, user); 
    },
    
    addRoomUser: function(user, room)
    {
        var oldRoom = user.room;
        
        // Apply circular references for each other
        user.isRoom(room);
        
        if (room.hasUser(user)) {
            console.log('reactivating ' + user.uid + ' to ' + room.name);
            
            // User was already in room, reactivate them
            this.reactivateRoomUser(user, room);
        } else {
            console.log('adding ' + user.uid + ' to ' + room.name);
            
            room.addUser(user);
            
            // Broadcast to the room of the new user
            this.broadcastRoom('connected', {
                user: user.getSimple()
            }, room, user);
            
            this.notifyRoomChange(room);                       
        }
        
        // Remove user from all other rooms
        var roomList = this.roomList.getList();
        
        // Delete room user, but avoid if they went back to same room
        if (oldRoom && oldRoom.name != room.name) {
            this.removeRoomUser(user, oldRoom);
        }
    },
    
    removeRoomUser: function(user, room, message)
    {
        // NOTE: It is possible that room was torn down when user was removed
        room.removeUser(user);
        
        if (!room.isFeatured() && !room.getUserCount()) {
            this.removeRoom(room);
        
        } else {
            if (message) {
                this.broadcastRoom('kicked', {
                    id:      user.uid,
                    message: message
                }, room);
                
            } else {
                console.log('disconnecting ' + user.uid + ' from ' + room.name);
                
                this.broadcastRoom('disconnected', {
                    id: user.uid
                }, room);
            }

            // Update everyone on room count change
            this.notifyRoomChange(room);
        }
    },
    
    reactivateRoomUser: function(user, room)
    {
        user.isConnected(true);
        user.isIdle(false);
        
        this.broadcastRoom('reconnected', {
            id: user.uid
        }, room);
    },
    
    removeRoom: function(room) {
        console.log('notifying room removal');
                
        var roomName = room.name;
        this.roomList.removeRoom(room);
        
        this.messageAll('roomdelete', {
            roomName: roomName
        });
    },
    
    notifyRoomChange: function(room) {
        console.log('notifying room change ' + room.name);
        
        if (!room.isHidden()) {
            // Not hidden, let everyone see changes
            this.messageAll('roomchange', {
                roomName:     room.name,
                roomCount:    room.getUserCount(),
                roomFeatured: room.isFeatured(),
                roomHidden:   room.isHidden()
            });
        } else {
            // If it is a hidden room, keep those in the room updated
            this.broadcastRoom('roomchange', {
                roomName:     room.name,
                roomCount:    room.getUserCount(),
                roomFeatured: room.isFeatured(),
                roomHidden:   room.isHidden()                
            }, room);
        }
    },  
    
    removeUser: function(user)
    {
        var room = user.isRoom();
        
        if (room) {
            this.removeRoomUser(user, room);            
        }
        
        if (message) {
            this.messageUser('restarting', {
                message: message
            }, user);
        } else {
            this.messageUser('logout', {}, user);
        }
        
        this.userList.removeUser(user);
    }
});
