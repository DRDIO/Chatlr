process.on('uncaughtException', function (exception) {
    console.log(exception.type);
    console.log(exception.message);
});

var _    = require('underscore'),
    Sioa = require('socketioauth');

module.exports = Sioa.extend({
    userList:      {},
    chatUserBlogs: {},
    chatBanned:    {},
    chatRooms:     {},
    chatOps:       {},

    init: function(config) {
        this._super(config);

        this.chatOps = this.config.chatOps;

        for (var roomName in this.config.chatRooms) {
            // Create each featured room and update list
            // this.roomCreate(roomName, true);
        }
    },

    onConnect: function(socket) {
        this._super(socket);

        // Additional app setup
        var session     = this.getSession(socket),
            userSession = session.user || null,
            time        = new Date().getTime(),
            user        = {};

        // Kick for corrupt session data
        if (!userSession || !userSession.uid) {
            socket.emit('restart', 'Unable to retrieve your account.');
        }

        console.log(userSession.uid);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // GLOBAL MANAGEMENT FOR USER
        //
        if (userSession.uid in this.userList) {
            // If user is already in list, pull from list
            user = this.userList[userSession.uid];
        } else {
            console.log('user is new');

            user = new User(userSession);
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
});