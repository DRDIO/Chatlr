// Socket.IO OAuth example with Tumblr

var Sioa   = require('../index'),
    config = require('./config');

var YourApp = Sioa.extend({
    userList: null,
    config: null,
    
    init: function(config) {
        // Perform your initializations for extended app
        this.config = config;
        
        // Call parent
        this._super(this.config, function(req) {    
            // If you want, a callback handled during page load to pull page data
            // We provide req.page to grab a handy url name
            
            console.log(req.params.page || '');            
        });
          
        this.userList = {};
    },
    
    onConnect: function(socket)
    {
        this._super(socket);
        
        // Additional app setup
        var session  = this.getSession(socket);
        
        this.userList[socket.id] = session;
        
        this.messageClient(socket, 'welcome', {
            sid: socket.id,
            message: 'Hello, new user!'
        });
        
        
    },
    
    onDisconnect: function()
    {
        // We are currently in the scope of the socket
        
        this._super();
    },
    
    onMessage: function(request)
    {
        // We are currently in the scope of the socket
        
        this._super(request);
        
        this.app.messageAll('forward', {
            sid: this.id,
            message: request.message
        });
    }
});

new YourApp(config);