// process.on('uncaughtException', function (exception) {
//     console.log(exception.type);
//     console.log(exception.message);
// });

var _        = require('underscore'),
    Sioa     = require('socketioauth'),
    UserList = require('./userlist'),
    RoomList = require('./roomlist');

var props = {    
    userList:      null,
    roomList:      null,

    init: function(config) {
        this._super(config);

        // Setup room and user lists
        this.roomList = new RoomList(this.config.roomList);
        this.userList = new UserList(null, this.config.opLevel, this.config.opList);
    },

    // Override socket connection to setup socket info
    onConnect: function(socket) {
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
                
                // Back reference between User and Socket for later
                this.initClient(user, roomName);
            }
        }
    },
    
    onDisconnect: function() {
        this._super();
        
        var user = this.app.userList.isUser(this.id, true);
        
        if (user) {
            user.isConnected(false);
        } else {
            console.log('invalid session to client pair (polling)');
        }        
    },
    
    onMessage: function(request)
    {
        this._super(request);
        
        var key    = _.first(_.keys(request)),
            method = 'get' + key.charAt(0).toUpperCase() + key.slice(1);
        
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
        
        
        // Nothing to do right now
    },
    
    initClient: function(socket, user, roomName)
    {
        // Stub for app extender
    },
    
    messageUser: function(method, request, user) 
    {
        console.log('whisper ' + method + ' to ' + user.uid);        
        this.messageClient(this.getSocket(user.sid), method, request);
    },
    
    broadcastRoom: function(method, request, room, userExclude)
    {
        console.log('broadcasting ' + method + ' to ' + room.name);
        
        var userList = room.getUserList(false, true);
        
        for (var uid in userList) {
            // Only send to non excluded and connected users
            if ((!userExclude || uid != userExclude.uid) && userList[uid].isConnected()) {
                this.messageClient(this.getSocket(userList[uid].sid), method, request);
            }
        }
    }
};

module.exports = Sioa.extend(props);