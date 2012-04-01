// process.on('uncaughtException', function (exception) {
//     console.log(exception.type);
//     console.log(exception.message);
// });

var _        = require('underscore'),
    Sioa     = require('socketioauth'),
    UserList = require('./userlist'),
    RoomList = require('./roomlist');

module.exports = Sioa.extend({
    userList:      {},
    roomList:      {},
    bannedList:    {},
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
        var session     = this.getSession(socket);
        
        if (!session) {
            socket.emit('restart', 'Unable to retrieve session.');
        } else {
            
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
                    user.isSid(socket.id);
                }
                
                // Back reference between User and Socket for later
                this.initClient(socket, user, roomName);
            }
        }
    },
    
    onMessage: function(request)
    {
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
            console.log('invalid method call');
        }
        
        
        // Nothing to do right now
    },
    
    broadcastRoom: function(method, request, room, userExclude)
    {
        var userList = room.getUserList();
        
        for (var uid in userList) {
            if (!userExclude || uid != userExclude.uid) {
                this.messageClient(this.getSocket(userList[uid].sid), method, request);
            }
        }
    }
});
