var _            = require('underscore'),
    Express      = require('express'),
    Connect      = require('connect'),
    SocketIo     = require('socket.io'),
    MongoJs      = require('mongojs'),

    OauthReq     = require('./lib/oauthreq'),
    Class        = require('./lib/class'),

    MemoryStore  = Express.session.MemoryStore;

var Sioa = {
    store:     null,
    server:    null,
    iosockets: null,
    db:        null,

    init: function(config) {
        console.log('Starting SocketIOAuth');

        if (config.db) {
            // Setup database connection
            this.db = MongoJs.connect(config.db.database || null);
        }

        if (config.server) {
            // The server provides access to Express server
            this.server = Express.createServer();
            this.store  = new MemoryStore();

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // Create a CONNECT server, add routes for a main page to start chat and a callback
            //
            // On INDEX: if no user in session, get Tumblr authorization routed to /callback
            //           otherwise, start chat server based on user name
            //
            // On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
            //
            this.server.configure(_.bind(function () {
                this.server.use(Express.cookieParser());
                this.server.use(Express.session({
                    store:  this.store,
                    secret: config.server.secret || 'sauce',
                    key:    'express.sid'
                }));

                if (config.server.publicPath) {
                    console.log('setting up public path ' + config.server.publicPath);

                    // Configure all public paths to be available (css, img, js, etc)
                    this.server.use(Express.static(config.server.publicPath));
                }

                if (config.oauth) {
                    console.log('setting up oauth');

                    // Attach server requests for OAuth automation
                    OauthReq(this.server, config.oauth);
                }

                this.server.listen(config.server.port || process.env.PORT, config.server.host || '0.0.0.0');
            }, this));

            if (config.socketio) {
                // Iosockets is the top level connection to Socket.IO
                this.iosockets = SocketIo.listen(this.server);

                // Link memory stores between express and socket.io
                this.iosockets.set('authorization', _.bind(function (data, accept) {
                    if (data.headers.cookie) {
                        data.cookie = Connect.utils.parseCookie(data.headers.cookie);
                        data.sessionID = data.cookie['express.sid'];
                        // (literally) get the session data from the session store
                        this.store.get(data.sessionID, function (err, session) {
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
                }, this));
            }


        }


        // Let user set log level for socket info
        this.iosockets.set('log level', config.socketio.logLevel || 2);

        // Bind the event for client connection (can be overridden by child)
        this.iosockets.on('connection', _.bind(this.onConnect, this));
    },

    onConnect: function(socket)
    {
        console.log('starting connection');

        // Apply a reference back to the core app to be used with onMessage
        socket.app = this;
        
        socket.on('message', this.onMessage);
        socket.on('disconnect', this.onDisconnect);
    },

    onDisconnect: function()
    {
        // Nothing to do right now but tear down
    },

    onMessage: function(request)
    {
        
    },
    
    messageClient: function(socket, method, request)
    {
        if (_.isObject(socket)) {
            request.type = method;        
            socket.json.send(request);
        } else {
            throw 'missing socket';
            console.log('missing socket');
        }
    },
    
    messageAll: function(method, request)
    {
        request.type = method;        
        this.iosockets.sockets.json.send(request);
    },

    getSocket: function(sid)
    {
        return this.iosockets.sockets.sockets[sid];
    },
    
    getSession: function(socket)
    {
        return socket.handshake.session || null;
    }
};


module.exports = Class.extend(Sioa);
