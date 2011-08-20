process.on('uncaughtException', function (err) {
    console.log(err.message);
    console.log(err.stack);
});

var config   = require('../config/config'),
    express  = require('express'),    
    app      = express.createServer(),
    io       = require('socket.io').listen(app),
    
    memoryStore  = express.session.MemoryStore,
    sessionStore = new memoryStore(),
    parseCookie  = require('connect').utils.parseCookie,
    
    redirect  = require('./redirect'),
    chat      = require('./chat')(io, config);    

io.set('log level', 2);

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Create a CONNECT server, add routes for a main page to start chat and a callback
//
// On INDEX: if no user in session, get Tumblr authorization routed to /callback
//           otherwise, start chat server based on user name
//
// On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
//    
app.configure(function () {
    app.use(express.cookieParser());
    app.use(express.session({ 
        store: sessionStore,
        secret: config.secret,
        key: 'express.sid'
    }));

    app.use(express.static(__dirname + '/../website'));
    app.use(express.router(redirect));

    app.listen(config.port, config.host);
});

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

io.sockets.on('connection', function (socket) {
    console.log('A socket with sessionID ' + socket.handshake.sessionID 
    + ' connected!');

    chat.setupEvents(socket);
});