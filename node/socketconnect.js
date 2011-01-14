// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat Extension variables
//
var io = require('./chat');
    
// // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Middleware prefix for Connect stack
//
io.Listener.prototype.prefixWithMiddleware = function (fn) {
    var self = this;
    return function (client) {
        var dummyRes = {
            writeHead: null
        };
        // Throw the request down the Connect middleware stack
        // so we can use Connect middleware for free.
        self.server.handle(client.request, dummyRes, function () {
            client.request.url = client.request.url || '';
            fn(client, client.request, dummyRes);
        });
    };
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Create exports function to call
//
module.exports = function(serverLambda) {
    var listener;
    return function (req, res, next) {
        if (!listener) {
            listener = io.listen(serverLambda(), {transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']});

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // Setup featured listener.chatRooms that last forever
            //
            listener.chatInit();
            
            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // Form on connection callback
            //
            listener.on('connection', listener.prefixWithMiddleware(function(client, req, res) {
                if (req && 'session' in req && 'user' in req.session) {
                    client.user     = req.session.user;
                    client.userName = req.session.user.name;

                    listener.userOnConnect(client);
                } else {
                    console.log(client.sessionId + ' is stuck with a socket and no session');
                }
            }));
        }
        next();
    };
};