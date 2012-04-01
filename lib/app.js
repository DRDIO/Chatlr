process.on('uncaughtException', function (exception) {
    console.log(exception.type);
    console.log(exception.message);
});

var _    = require('underscore'),
    Sioa = require('socketioauth');

module.exports = Sioa.extend({
    chatUsers:    null,
    chatUserBlogs:    null,
    chatBanned:    null,
    chatRooms:    null,
    chatOps:    null;

    init: function(config) {
        this._super(config);

        this.chatOps = this.config.chatOps;

        for (var roomName in this.config.chatRooms) {
            // Create each featured room and update list
            // this.roomCreate(roomName, true);
        }
    },

    onConnect: function(socket) {

    }
});

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