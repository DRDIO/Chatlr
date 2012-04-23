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
    
    e_away: function(user) {
        var room = user.isRoom();
        
        if (!user.isIdle() && room) {
            user.isIdle(true);
            
            this.broadcastRoom('away', {
                id: user.uid
            }, room);
        }     
    },
            
    e_ban: function(user, banUid, banRoomName, minutes, reason) {
        if (user.isOp()) {
            var banUser = this.userList.isUser(banUid);
            
            if (banUser) {                
                this.banUser(banUser, banRoomName, minutes, reason);
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
    
    e_change: function(user, roomName)
    {
        var room = this.roomList.isRoom(roomName, true);

        this.initRoomUser(user, room);
    },
    
    e_deban: function(user, debanUid)
    {
        if (user.isOp()) {
            var banUser = this.userList.isUser(debanUid);
            
            if (banUser) {
                this.userList.isUserBanned(user, 0);
            }
        }    
        
        // TODO: Notify rooms of changes
    },
    
    e_defeature: function(user, roomName)
    {
        if (user.isOp()) {
            var room = this.roomList.isRoom(roomName);
            
            if (room && room.isFeatured()) {
                this.roomList.isFeatured(room, false);
                
                this.broadcastRoom('status', {
                    message: 'This room has been de-featured...'
                }, room);
                
                
                // Update people's UIs
                this.notifyRoomChange(room);
            }
        }
    },
    
    e_deop: function(user, deopUid) {
        if (user.isOp()) {
            var deopUser = this.userList.isUser(deopUid);

            if (deopUser) {
                this.userList.isOp(deopUser, false);
                
                var opRoom = deopUser.isRoom();
                
                if (opRoom) {
                    this.messageUser('status', {
                        message: 'You are no longer a Chatlr operator...'
                    }, deopUser);
                    
                    this.broadcastRoom('reconnected', {
                        id: deopUser.uid,
                        op: false
                    }, opRoom);
                }
            }
        }
    },
    
    e_feature: function(user, roomName)
    {
        if (user.isOp()) {
            var room = this.roomList.isRoom(roomName, true);
            
            if (room && !room.isFeatured()) {
                this.roomList.isFeatured(room, true);
                
                this.broadcastRoom('status', {
                    message: 'This room is now featured!'
                }, room);
                
                // Update people's UIs
                this.notifyRoomChange(room);
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
    
    e_logout: function(user)
    {
        console.log('logging out ' + user.uid);
        this.removeUser(user);
    },
    
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
    
    e_op: function(user, opUid) {
        if (user.isOp()) {
            var opUser = this.userList.isUser(opUid);

            if (opUser) {
                this.userList.isOp(opUser, true);
                
                var opRoom = opUser.isRoom();
                
                if (opRoom) {
                    this.messageUser('status', {
                        message: 'You are now a Chatlr operator!'
                    }, opUser);
                    
                    this.broadcastRoom('reconnected', {
                        id: opUser.uid,
                        op: true
                    }, opRoom);
                }
            }
        }
    },
    
    e_shout: function(user, message)
    {
        if (user.isOp()) {
            this.messageAll('status', { message: message });
        }
    },
    
    e_topic: function(user, topic) 
    {
        if (user.isOp()) {
            var room = user.isRoom();
            
            if (room) {
                room.isTopic(topic);

                this.broadcastRoom('settopic', {
                    topic: topic
                }, room);
            }
        }
    },
    
    e_whisper: function(user, whisperUid, message) {
        
    },
    
    e_settimer: function(user, timer, minutes)
    {
        if (user.isOp()) {
            if (timer in this.timerList) {
                this.timerList[timer] = parseFloat(minutes) * 60000;
                
                if (timer == 'cleanup') {
                    this.setCleanup();
                }
                this.messageUser('status', {
                    message: 'Timer ' + timer + ' updated to ' + minutes + ' minutes.'
                }, user);
            }
        }
    }
};

module.exports = AppAction.extend(AppEvent);