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

        if (!client.request) {
            client.request = {
                url: null,
                method: null
            }
        }
        // Throw the request down the Connect middleware stack
        // so we can use Connect middleware for free.
        self.server.handle(client.request, dummyRes, function () {
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
        try {
            if (!listener) {
                listener = io.listen(serverLambda());

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                // Setup featured listener.chatRooms that last forever
                //
                listener.chatInit();

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                // Form on connection callback
                //
                listener.on('connection', listener.prefixWithMiddleware(function(client, req, res) {
                    try {
                        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                        // Setup message and disconnect events
                        client.on('message', listener.userOnMessage);
                        client.on('disconnect', listener.userOnDisconnect);
                    } catch (err) {
                        console.log(err.message);
                        console.log(err.stack);
                    }
                }));
            }
            next();
        } catch (err) {
            console.log(err.message);
            console.log(err.stack);
        }
    };
};