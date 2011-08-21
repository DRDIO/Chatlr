// An abstract class that can be extended by APP to have socket support

/**
 * constructor
 * Initialize Chatroom: Setup rooms and timers
 *
 * @see roomCreate()
 * @see chatCleanup()
 */
function app(sockets, config) {
//    console.log('inside chat constructor');
    // Basic setup to use sockets
    
    this.sockets = sockets;
    this.config  = config;
    
    // Initialize app object at socket startup
    this.__construct();
    
    var self = this;
    sockets.on('connection', function (socket) {
//        console.log('socket connection started');
        
        var sid = socket.id;
        
        // Extended by APP to initialize a socket (client/user)
        self._init(sid);
                
        socket.on('message', function(data) {
//            console.log('a message was received');
            
//            for (key in data) break;
//            var method = '_' . key;

            var key    = data.type || null,
                method = '_' + key;
            
            if (method in self) {
                var args = [sid];
                for (var key in data) {
                    if (key != 'type') {
                        args.push(data[key]);
                    }
                }
                
                self[method].apply(self, args);
            } else {
                console.log('invalid convention method structure.');
            }
        });
        
        socket.on('disconnect', function() {
            self._disconnect(sid);
        });
    });
}

app.prototype.__getSession = function(sid)
{    
    if (sid in this.sockets.sockets) {
        return this.sockets.sockets[sid].handshake.session || {};
    }
    
    return {};
}

app.prototype.__send = function(sid, method, args)
{
//    console.log('sending message of ' + method);
    
    var data = args;
    data['type'] = method;
    
    this.sockets.sockets[sid].json.send(data);    
}

app.prototype.__broadcast = function(sid, method, args)
{
//    console.log('broadcasting message of ' + method);
    
    var data = args;
    data['type'] = method;
    
    this.sockets.sockets[sid].json.broadcast(data);    
}

app.prototype.__sendAll = function(method, args)
{
//    console.log('sending to all message of ' + method);
    
    var data = args;
    data['type'] = method;
    
    this.sockets.json.send(data);    
}

app.prototype.__construct = function()
{
    
}

app.prototype._init = function(sid)
{
    // Extend this method for your app
}

app.prototype._disconnect = function(sid)
{
    // Extend this method for your app
}

module.exports = app;