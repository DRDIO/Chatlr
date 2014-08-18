var _         = require('underscore'),
    AppAction = require('../../lib/appaction'),
    Utils     = require('../../lib/utils');

module.exports = {
    connect: function(req)
    {
        try {
            this._super(socket);

            // Additional app setup
            var session = this.getSession(socket);

            if (!session) {
                socket.emit('restart', 'Unable to retrieve session.');
            } else {
                var roomName    = session.page || this.roomList.dftName,
                    userSession = session.user || null;

                // Kick for corrupt session data
                if (!userSession || !userSession.uid) {
                    console.log('Unable to setup user session');
                    socket.emit('restart', 'Unable to retrieve your account.');

                } else {
                    // Store their current SID to pass into onConnect
                    userSession.sid = socket.id;

                    // Perform the necessary db checks to load up a user
                    this.userList.onConnect(userSession, roomName, _.bind(function(user, roomName) {
                        // Verify that room and user exist (create room if not)
                        var room = this.roomList.isRoom(roomName, true);
                        this.initRoomUser(user, room);
                    }, this));
                }
            }
        } catch (err) {
            console.log('AppBoiler.onConnect');
            console.log(err.stack || err.message || err);
        }
    },

    message: function(req)
    {
        var user    = req.data.user,
            message = req.data.message
        ;

        var room = user.isRoom();

        if (room) {
            // Not idle if sending messages of any kind
            user.isIdle(false);

            // Limit how long a message can be
            message = message.substr(0, 350);

            // If there is a message and it isn't the same as their last (griefing)
            if (AppAction.isMessageAllowed(user, message)) {
                if (!user.isOp()) {
                    message = Utils.filterMessage(message);
                }

                // Store last message for later
                user.isLastMessage(message);
                room.bufferMessage(user, message);

                // console.log('broadcasting message');

                AppAction.broadcastRoom('message', {
                    id:      user.isUid(),
                    message: message
                }, room);
            }
        }
    },

    shout: function(user, message)
    {
        if (user.isOp() == 4) {
            AppAction.messageAll('status', { message: message });
        }
    },

    topic: function(user, topic)
    {
        if (user.isOp()) {
            var room = user.isRoom();

            if (room) {
                AppAction.roomList.isTopic(room, topic);

                AppAction.broadcastRoom('settopic', {
                    topic: topic
                }, room);
            }
        }
    },

    whisper: function(user, whisperUid, message)
    {
        console.log(user.uid + ' whispers ' + whisperUid + ' ' + message);

        var whisperUser = AppAction.userList.isUser(whisperUid);

        if (whisperUser) {
            // A whisper goes out to sender and receiver
            // We return entire user since whispers can happen across rooms
            AppAction.messageUser('whisper', {
                user:    user.getSimple(),
                message: message
            }, whisperUser);

            AppAction.messageUser('whisper', {
                id:      user.isUid(),
                wid:     whisperUser.isUid(),
                message: message
            }, user);
        }

    },

    settimer: function(user, timer, minutes)
    {
        if (user.isOp() == 4) {
            if (timer in AppAction.timerList) {
                AppAction.timerList[timer] = parseFloat(minutes) * 60000;

                if (timer == 'cleanup') {
                    AppAction.setCleanup();
                }
                AppAction.messageUser('status', {
                    message: 'Timer ' + timer + ' updated to ' + minutes + ' minutes.'
                }, user);
            }
        }
    },

    away: function(user) {
        AppAction.idleRoomUser(user);
    },

    ban: function(user, banUid, banRoomName, minutes, reason) {
        if (user.isOp()) {
            var banUser = AppAction.userList.isUser(banUid);

            if (banUser && banUser.isOp() < 3) {
                AppAction.banUser(banUser, banRoomName, minutes, reason);
            }
        }

        // TODO: Notify rooms of changes
    },

    banlist: function(user) {
        if (user.isOp()) {
            AppAction.messageUser('banlist', {
                list: AppAction.userList.getBanList()
            });
        }
    },

    change: function(user, roomName)
    {
        var room = AppAction.roomList.isRoom(roomName, true);

        AppAction.initRoomUser(user, room);
    },

    deban: function(user, debanUid)
    {
        if (user.isOp()) {
            var banUser = AppAction.userList.isUser(debanUid);

            if (banUser) {
                AppAction.userList.isUserBanned(user, 0);
            }
        }

        // TODO: Notify rooms of changes
    },

    defeature: function(user, roomName)
    {
        if (user.isOp() == 4) {
            var room = AppAction.roomList.isRoom(roomName);

            if (room && room.isFeatured()) {
                AppAction.roomList.isFeatured(room, false);

                AppAction.broadcastRoom('status', {
                    message: 'This room has been de-featured...'
                }, room);


                // Update people's UIs
                AppAction.notifyRoomChange(room);
            }
        }
    },

    deop: function(user, deopUid) {
        if (user.isOp() == 4) {
            var deopUser = AppAction.userList.isUser(deopUid);

            if (deopUser) {
                AppAction.userList.isUserOp(deopUser, 0);

                var opRoom = deopUser.isRoom();

                if (opRoom) {
                    AppAction.messageUser('deop', {
                        message: 'You are no longer a Chatlr operator...'
                    }, deopUser);

                    AppAction.broadcastRoom('reconnected', {
                        id: deopUser.uid,
                        op: false
                    }, opRoom);
                }
            }
        }
    },

    feature: function(user, roomName)
    {
        if (user.isOp()) {
            var room = AppAction.roomList.isRoom(roomName, true);

            if (room && !room.isFeatured()) {
                AppAction.roomList.isFeatured(room, true);

                AppAction.broadcastRoom('status', {
                    message: 'This room is now featured!'
                }, room);

                // Update people's UIs
                AppAction.notifyRoomChange(room);
            }
        }
    },

    kick: function(user, kickUid, kickRoomName, reason) {

        if (user.isOp()) {
            var kickUser = AppAction.userList.isUser(kickUid);

            if (kickUser && kickUser.isOp() < 3) {
                AppAction.banUser(kickUser, kickRoomName || '!kicked', 0, reason);
            }
        }
    },

    logout: function(user)
    {
        console.log('logging out ' + user.uid);
        AppAction.removeUser(user);
    },

    op: function(user, opUid) {
        if (user.isOp() == 4) {
            var opUser = AppAction.userList.isUser(opUid);

            if (opUser) {
                AppAction.userList.isUserOp(opUser, 3);

                var opRoom = opUser.isRoom();

                if (opRoom) {
                    AppAction.messageUser('op', {
                        message: 'You are now a Chatlr operator!'
                    }, opUser);

                    AppAction.broadcastRoom('reconnected', {
                        id: opUser.uid,
                        op: true
                    }, opRoom);
                }
            }
        }
    }
};