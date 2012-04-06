var _         = require('underscore'),
    AppBoiler = require('./appboiler');
  
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// App Action contains all methods that delegate actions to the room and user objects
// It is built off of AppBoiler, which sets up all the necessary object relationships
// @see AppBoiler

var AppAction = {
    
    isMessageAllowed: function(user, message) {
        var time = new Date().getTime();
        
        return message.length && (user.isOp() || (
            !user.isBanned() && message != user.lastMessage && time - user.tsMessage > 2000))
    },
    
    initRoomUser: function(user, room, prevMessage)
    {
        try {            
            console.log('calling init room user for ' + user.uid + ' and ' + room.name);

            // Add user to the room (always happen on init)
            // This will also remove user from other rooms if necessary
            this.addRoomUser(user, room, prevMessage);   

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
        } catch (err) {
            console.log('AppAction.initRoomUser');
            console.log([user, room, prevMessage]);
            console.log(err);            
        }
    },
    
    addRoomUser: function(user, room, prevMessage)
    {
        try {  
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

            // Delete room user, but avoid if they went back to same room
            if (oldRoom && oldRoom.name != room.name) {
                this.removeRoomUser(user, oldRoom, prevMessage);
            }
        } catch (err) {
            console.log('AppAction.addRoomUser');
            console.log([user, room, prevMessage]);
            console.log(err);            
        }        
    },
    
    removeRoomUser: function(user, room, message)
    {
        // NOTE: It is possible that room was torn down when user was removed
        room.removeUser(user);
        
        if (!room.isFeatured() && !room.getUserCount()) {
            this.removeRoom(room);
        
        } else {
            this.broadcastRoom('disconnected', {
                id:      user.uid,
                message: (message ? message : 'left')
            }, room);
            
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
    
    removeUser: function(user, message)
    {
        var room = user.isRoom();
        
        if (room) {
            this.removeRoomUser(user, room);            
        }
        
        if (message) {
            this.messageUser('restart', {
                message: message
            }, user);
        } else {
            this.messageUser('logout', {}, user);
        }
        
        this.userList.removeUser(user);
    },
    
    banUser: function(user, roomName, minutes, reason)
    {
        minutes = parseInt(minutes);

        var time        = new Date().getTime(),
            duration    = (minutes >= 0 ? time + minutes * 60000 : -1),
            room        = this.roomList.isRoom(roomName || '!banned', true),
            prevMessage = (!minutes ? 'kicked' : 'banned ' + (minutes == -1 ? 'forever' :  'for ' + minutes + ' minutes'))
                + ' to #' + room.name + ' (' + (reason ? reason : 'no reason given') + ')';

        this.userList.isUserBanned(user, duration);
        this.initRoomUser(user, room, prevMessage);
    }
};

module.exports = AppBoiler.extend(AppAction);
