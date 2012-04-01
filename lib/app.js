process.on('uncaughtException', function (exception) {
    console.log(exception.type);
    console.log(exception.message);
});

var _        = require('underscore'),
    Sioa     = require('socketioauth'),
    UserList = require('./userlist'),
    RoomList = require('./roomlist');

module.exports = Sioa.extend({
    userList:      {},
    roomList:      {},
    opList:        {},

    init: function(config) {
        this._super(config);

        // Setup default operators
        for (var op in this.config.opList) {
            if (_.isString(op)) {
                // Save operator list, default to -1 if no match
                if (this.config.opList[op] in this.config.opLevel) {
                    this.opList[op] = this.config.opList[op];
                }
            }
        }

        // Setup room and user lists
        this.roomList = new RoomList(this.config.roomList);
        this.userList = new UserList();
    },

    // Override socket connection to setup socket info
    onConnect: function(socket) {
        this._super(socket);

        // Additional app setup
        var session     = this.getSession(socket),
            page        = session.page || _.first(_.keys(this.chatRooms)),
            userSession = session.user || null,
            user        = {};

        // Kick for corrupt session data
        if (!userSession || !userSession.uid) {
            socket.emit('restart', 'Unable to retrieve your account.');
        } else {
            console.log(userSession.uid);

            // Attempt to get existing user, if it can't be retrieved, create it
            user = this.userList.isUser(userSession.uid);
            if (!user) {
                user = this.userList.addUser(userSession);
            }

            // Set default room, setup operator status, setup banned status (might change room)
            user.setRoom(page);
            user.isOp(this.opList);
            user.isBanned(this.bannedList);

            // Update user to be connected
            user.isConnected(true);

            // Place into proper room, initialize room and send info on users to client user
            this.userInitRoom(socket, user.uid, user.room);
        }
    },

    initRoomUser: function(socket, userUid, roomName) {
        // Verify that room and user exist
        // TODO: Pass actual object references?
        var room = this.roomList.isRoom(roomName),
            user = this.userList.isUser(userUid);

        if (user && room) {
            room.addUser(userUid);

            socket.emit('approved', {
                id:           user.uid,
                roomName:     room.name,
                roomList:     this.roomList.getList(),
                roomUserList: room.getUserList(),
                topic:        room.topic,
                buffer:       room.buffer,
                userBlogList: user.getBlogList()
            });

            console.log(user.name + ' sent room init for ' + room.name);
        } else {
            console.log('invalid ' + userUid + ' ' + roomName);
        }
    }
});