var _        = require('underscore'),
    Sioa     = require('socketioauth'),
    UserList = require('./userlist'),
    RoomList = require('./roomlist');

var AppBoiler = {    
    userList:      null,
    roomList:      null,

    init: function(config) {
        this._super(config);

        // Setup room and user lists
        this.roomList = new RoomList(this.config.roomList);
        this.userList = new UserList(null, this.config.opLevel, this.config.opList);
        
        setTimeout(this.cleanup, this.config.interval);
    },

    // Override socket connection to setup socket info
    onConnect: function(socket) {
        try {
            this._super(socket);

            // Additional app setup
            var session     = this.getSession(socket);

            if (!session) {
                socket.emit('restart', 'Unable to retrieve session.');
            } else {

                console.log(session.page);

                var roomName    = session.page || 'english',
                    userSession = session.user || null,
                    user        = {};

                // Kick for corrupt session data
                if (!userSession || !userSession.uid) {
                    socket.emit('restart', 'Unable to retrieve your account.');
                } else {
                    console.log('onConnect UID ' + userSession.uid);

                    // Attempt to get existing user, if it can't be retrieved, create it                
                    user = this.userList.isUser(userSession.uid);
                    if (!user) {
                        console.log('Creating New User');
                        userSession.sid = socket.id;
                        user = this.userList.addUser(userSession);
                    } else {
                        // Update user to be connected
                        user.isConnected(true);
                        this.userList.refreshUserSid(user, socket.id);
                    }

                    this.userList.isUserOp(user);

                    // Verify that room and user exist (create room if not)
                    var room = this.roomList.isRoom(roomName, true);
                    this.initRoomUser(user, room);
                }
            }
        } catch (err) {
            console.log('AppBoiler.onConnect');
            console.log(err);
        }
    },
    
    onDisconnect: function() {
        try {
            this._super();

            var user = this.app.userList.isUser(this.id, true);

            if (user) {
                user.isConnected(false);
            } else {
                console.log('invalid session to client pair (polling)');
            }        
        } catch(err) {
            console.log('AppBoiler.onDisconnect');
            console.log(err);
        }
    },
    
    onMessage: function(request)
    {
        try {
            this._super(request);

            var key    = _.first(_.keys(request)),
                method = 'e_' + key;

            if (_.isFunction(this.app[method])) {
                // In our onMessage override, we are always trying to get a UID
                var user = this.app.userList.isUser(this.id, true);

                if (user) {
                    request[key].unshift(user);                
                    this.app[method].apply(this.app, request[key]);
                } else {
                    console.log('unable to track user ' + this.id);
                }
            } else {
                console.log('invalid method call ' + key);
            }       
        } catch(err) {
            console.log('AppBoiler.onMessage');
            console.log(err);
        }
    },
    
    messageUser: function(method, request, user) 
    {
        this.messageClient(this.getSocket(user.sid), method, request);
    },
    
    broadcastRoom: function(method, request, room, userExclude)
    {
        var userList = room.getUserList(false, true);
        
        for (var uid in userList) {
            // Only send to non excluded and connected users
            if ((!userExclude || uid != userExclude.uid) && userList[uid].isConnected()) {
                this.messageClient(this.getSocket(userList[uid].sid), method, request);
            }
        }
    },
    
    cleanup: function()
    {
        try {
            var time = new Date().getTime();

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // USER CLEANUP
            //
            for (var user in this.userList) {
                var bannedDuration = this.userList.isUserBanned(user);
                
                // Unban users based on duration (if not set to forever)
                if (bannedDuration >= 0 && bannedDuration < time) {
                    this.userList.isUserBanned(user, false);
                }
                
                if (!user.isConnected() && time - user.tsDisconnect > this.config.interval) {
                    this.removeUser(user, 'You were disconnected for too long (C1).');
                    
                } else if (!user.isIdle() && time - user.tsMessage > this.config.intIdle) {
                    user.isIdle(true);
                    
                    this.roomBroadcast('away', {
                        id:   user.uid
                    }, user.isRoom());
                    
                } else if (user.isIdle() && !user.isOp() && time - user.tsMessage > this.config.intKick) {
                    // Kick users who squat in chat (not OP of course)                
                    this.removeUser(user, 'You were idle for too long (C2).');
                }
            }

        } catch(err) {
            console.log('AppBoiler.cleanup');
            console.log(err);
        }
    }
};

module.exports = Sioa.extend(AppBoiler);