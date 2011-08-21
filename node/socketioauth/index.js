var express  = require('express'),    
    server   = express.createServer(),
    io       = require('socket.io').listen(server),
    
    memoryStore  = express.session.MemoryStore,
    sessionStore = new memoryStore(),
    parseCookie  = require('connect').utils.parseCookie,
    
    requests  = require('./requests');   


module.exports = function(config) {
    io.set('log level', config.logLevel);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Create a CONNECT server, add routes for a main page to start chat and a callback
    //
    // On INDEX: if no user in session, get Tumblr authorization routed to /callback
    //           otherwise, start chat server based on user name
    //
    // On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
    //    
    server.configure(function () {
        server.use(express.cookieParser());
        server.use(express.session({ 
            store: sessionStore,
            secret: config.secret,
            key: 'express.sid'
        }));

        server.use(express.static(__dirname + config.websitePath));
        
        // Attach server requests
        requests(server, config);

        server.listen(config.port, config.host);
    });

    // Link memory stores between express and socket.io
    io.set('authorization', function (data, accept) {
        if (data.headers.cookie) {
            data.cookie = parseCookie(data.headers.cookie);
            data.sessionID = data.cookie['express.sid'];
            // (literally) get the session data from the session store
            sessionStore.get(data.sessionID, function (err, session) {
                if (err) {
                    // if we cannot grab a session, turn down the connection
                    accept(err.message, false);
                } else {
                    // save the session data and accept the connection
                    data.session = session;
                    accept(null, true);
                }
            });
        } else {
           return accept('No cookie transmitted.', false);
        }
    });    

    // Return the sockets (it has circular references to server and client as well)
    return io.sockets;
}