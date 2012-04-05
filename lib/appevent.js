var _         = require('underscore'),
    AppAction = require('./appaction');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// App Event stores all automated methods between client and server
// Most of these will end up calling methods in AppAction
// @see AppAction

var AppEvent = {
    
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
    },
    
    getRoomchange: function(user, roomName)
    {
        var room = this.roomList.isRoom(roomName, true);
        
        this.initRoomUser(user, room);
    },
    
    getLogout: function(user)
    {
        this.removeUser(user);
    }
};

module.exports = AppAction.extend(AppEvent);