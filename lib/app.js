// process.on('uncaughtException', function (exception) {
//     console.log(exception.type);
//     console.log(exception.message);
// });

var _        = require('underscore'),
    Boiler   = require('./boiler');

module.exports = Boiler.extend({
    
    initClient: function(socket, user, roomName)
    {
        // Set default room, setup operator status, setup banned status (might change room)
        user.isOp(this.opList);

        if (user.isBanned(this.bannedList)) {
            // If user is banned, put them into the proper isolation room
            roomName = this.bannedList[user.name] || 'banned';
        }

        // Verify that room and user exist (create room if not)
        var room = this.roomList.isRoom(roomName, true);

        // Apply circular references for each other
        user.isRoom(room);
        room.addUser(user);

        this.messageClient(socket, 'approved', {
            id:           user.uid,
            roomName:     room.name,
            roomList:     this.roomList.getList(true),
            roomUserList: room.getUserList(true),
            topic:        room.topic,
            buffer:       room.buffer,
            userBlogList: user.getBlogList()                
        });

        console.log(user.name + ' sent room init for ' + room.name);         
    },
    
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Methods called directly by client through socket

    getMessage: function(user, message) 
    {
        console.log('retrieving message for ' + user.name);
        
        var room = user.isRoom(),
            time = new Date().getTime();

        // Not idle if sending messages of any kind
        user.isIdle(false);

        // Limit how long a message can be
        message = message.substr(0, 350);

        // If there is a message and it isn't the same as their last (griefing)
        if (message.length && (user.isOp() || (
            !user.isBanned() && message != user.lastMessage && time - user.tsMessage > 2000))) {

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

            if (!user.isOp()) {
                // Replace repetitive characters
                message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

                // I also hate capslocking
                if (message.search(/[A-Z ]{6,}/) != -1) {
                    message = message.toLowerCase();
                }
            }

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

            // Store last message for later
            user.isLastMessage(message);            
            room.bufferMessage(user, message);
            
            console.log('broadcasting message');
            
            this.broadcastRoom('message', {
                type:    'message',
                id:      user.uid,
                message: message
            }, room);
        }
    }
});
