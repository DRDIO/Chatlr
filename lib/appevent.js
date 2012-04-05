var _         = require('underscore'),
    AppAction = require('./appaction'),
    Utils     = require('./utils');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// App Event stores all automated methods between client and server
// Most of these will end up calling methods in AppAction
// @see AppAction

/**
 * @augments AppAction
 */
var AppEvent = {
    
    e_message: function(user, message) 
    {
        var room = user.isRoom();

        if (room) {
            // Not idle if sending messages of any kind
            user.isIdle(false);

            // Limit how long a message can be
            message = message.substr(0, 350);

            // If there is a message and it isn't the same as their last (griefing)
            if (this.isMessageAllowed(user, message)) {
                if (!user.isOp()) {
                    message = Utils.filterMessage(message);
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
        }
    },
    
    e_change: function(user, roomName)
    {
        var room = this.roomList.isRoom(roomName, true);

        this.initRoomUser(user, room);
    },
    
    e_logout: function(user)
    {
        this.removeUser(user);
    },
    
    e_shout: function(user, message)
    {
        if (user.isOp()) {
            this.messageAll('status', message);
        }
    },
    
    e_topic: function(user, topic) 
    {
        if (user.isOp()) {
            var room = user.isRoom();
            
            if (room) {
                Room.isTopic(topic);

                this.broadcastRoom('settopic', {
                    topic: topic
                }, room);
            }
        }
    },
    
    e_feature: function(user, roomName)
    {
        if (user.isOp()) {
            var room = this.roomList.isRoom(roomName, true);
            
            if (room) {
                room.isFeatured(true);
            }
        }        
    },
    
    e_defeature: function(user, roomName)
    {
        if (user.isOp()) {
            var room = this.roomList.isRoom(roomName);
            
            if (room) {
                room.isFeatured(false);
            }
        }
    },
    
    e_op: function(user, opName) {
        if (user.isOp()) {
            var opUser = this.userList.isUser(opName);

            if (opUser) {
                opUser.isOp(true);
            }
        }
    },
    
    e_deop: function(user, opName) {
        if (user.isOp()) {
            var opUser = this.userList.isUser(opName);

            if (opUser) {
                opUser.isOp(false);
            }
        }
    },
    
    e_kick: function(user, kickUid, kickRoomName, reason) {
        
        if (user.isOp()) {
            var kickUser = this.userList.isUser(kickUid);
            
            if (kickUser) {
                this.banUser(kickUser, kickRoomName || '!kicked', 0, reason);
            }            
        }                
    },
    
    e_ban: function(user, banName, banRoomName, minutes, reason) {
        if (user.isOp()) {
            var banUser = this.userList.isUser(banName);
            
            if (banUser) {                
                this.banUser(banUser, banRoomName, minutes, reason);
            }
        }
        
        // TODO: Notify rooms of changes
    },
    
    e_deban: function(user, banName)
    {
        if (user.isOp()) {
            var banUser = this.userList.isUser(banName);
            
            if (banUser) {
                this.userList.isUserBanned(user, 0);
            }
        }    
        
        // TODO: Notify rooms of changes
    },
    
    e_banlist: function(user) {
        if (user.isOp()) {
            this.messageUser('banlist', {
                list: this.userList.getBanList()
            });
        }
    },
    
    e_away: function(user) {
        var room = user.isRoom();
        
        if (!user.isIdle() && room) {
            user.isIdle(true);
            
            this.broadcastRoom('away', {
                id: user.uid
            }, room);
        }     
    },
    
    e_whisper: function(user, whisperName, message) {
        
    }
};

module.exports = AppAction.extend(AppEvent);