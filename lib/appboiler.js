var _        = require('underscore'),
    Sioa     = require('./socketioauth'),
    UserList = require('./userlist'),
    RoomList = require('./roomlist');

var AppBoiler = {    
    timerList:     null,
    userList:      null,
    roomList:      null,
    cleanupIntvl:  null,

    init: function(config) {
        try {
            this._super(config, function(req, res) {                
                // Rewrite malformed pages to preserve page creation
                var page     = req.params.page || '',
                    sanePage = page.toLowerCase().replace(/[^a-z0-9]+/ig, '-').replace(/(^-|-$)/ig, '') || '';

                if (page.substr(0,1) == '!') {
                    sanePage = '!' + sanePage;
                }

                if (page != sanePage) {                    
                    res.writeHead(303, {'Location': '/' + sanePage});
                    res.end();
                    
                    // Return true so the rest of oauthreq doesn't occur
                    return true;
                } else {
                    // Store the page for when callback occurs
                    req.session.page = sanePage;
                }
            });

            this.timerList = config.timerList;

            // Setup room and user lists
            this.roomList = new RoomList(this.db.collection('room'), config.dft.room || null);
            this.userList = new UserList(this.db.collection('user'), config.dft.owner || null);

            this.setCleanup();

        } catch (err) {
            console.log(err.stack || err.message || err);
        }
    },
    
    setCleanup: function() {
        console.log('setting up cleanup');
        clearInterval(this.cleanupIntvl);
        this.cleanupIntvl = setInterval(_.bind(this.cleanup, this), this.timerList.cleanup);
    },

    // Override socket connection to setup socket info
    onConnect: function(socket) {
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
    
    onDisconnect: function() {
        try {
            this._super();

            var user = this.app.userList.isUser(this.id, true);

            if (user) {
                console.log('disconnecting ' + user.uid);
                user.isConnected(false);
                
                this.app.idleRoomUser(user);
                
            } else {
                console.log('invalid session to client pair (polling)');
            }        
        } catch(err) {
            console.log('AppBoiler.onDisconnect');
            console.log(err.stack || err.message || err);
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
            console.log(err.stack || err.message || err);
        }
    },
    
    messageUser: function(method, request, user) 
    {
        try {
            this.messageClient(this.getSocket(user.sid), method, request);
        } catch(err) {
            console.log('AppBoiler.messageUser ' + method);
            console.log(err.stack || err.message || err);
        }
    },
    
    broadcastRoom: function(method, request, room, userExclude)
    {
        try {
            var userList = room.getUserList(false);

            var time = (new Date).getTime();
            
            for (var uid in userList) {
                // Only send to non excluded and connected users
                if ((!userExclude || uid != userExclude.uid) && userList[uid].isConnected()) {
                    this.messageClient(this.getSocket(userList[uid].sid), method, request);
                }
            }
            
            console.log('TIMER: Room Broadcast: ' + time + ' to ' + (new Date).getTime());
        } catch(err) {
            console.log('AppBoiler.broadcastRoom');
            console.log(err.stack || err.message || err);
        }
    },
    
    cleanup: function()
    {
        try {
            var time = new Date().getTime();

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // USER CLEANUP
            //
            
            for (var uid in this.userList.uidList) {
                var user           = this.userList.uidList[uid],
                    bannedDuration = this.userList.isUserBanned(user);
                
                // Unban users based on duration (if not set to forever)
                if (bannedDuration > 0 && bannedDuration < time) {
                    console.log(bannedDuration + ' debanning ' + user.uid);
                    this.userList.isUserBanned(user, false);
                }
                
                if (!user.isConnected() && time - user.tsDisconnect > this.timerList.remove) {
                    console.log('disconnecting ' + user.uid);
                    this.removeUser(user, -1);
                    
                } else if (!user.isIdle() && time - user.tsMessage > this.timerList.idle) {
                    console.log('setting to idle ' + user.uid);
                    user.isIdle(true);
                    
                    this.broadcastRoom('away', {
                        id:   user.uid
                    }, user.isRoom());
                    
                } else if (user.isIdle() && !user.isOp() && time - user.tsMessage > this.timerList.kick) {
                    console.log('idle disconnecting ' + user.uid);
                    
                    // Kick users who squat in chat (not OP of course)                
                    this.removeUser(user, 'You were idle for too long (C2).');
                }
            }
            
            console.log('TIMER: Cleanup: ' + time + ' to ' + (new Date).getTime());

        } catch(err) {
            console.log('AppBoiler.cleanup');
            console.log(err.stack || err.message || err);
        }
    }
};

module.exports = Sioa.extend(AppBoiler);