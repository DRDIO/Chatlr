// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Error catching!
//
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Too lazy to figure out npm, so add required paths
//
require.paths.unshift('/www/tumblrchat/config');
require.paths.unshift('/www/tumblrchat/node');

var config  = require('config'),
    connect = require('connect'),
    url     = require('url'),
    fs      = require('fs'),
    xml2js  = require('xml2js'),
    oauth   = require('oauth'),
    io      = require('socket.io');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat variables
//
var banned    = {},
    creds     = {},
    rooms     = {},
    roomCount = 0,
    userCount = 0;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Setup OAUTH to Tumblr with key and secret
// TODO: Move to config node.js file
//
var oa = new oauth.OAuth(config.requestUrl, config.accessUrl, config.consumerKey, config.consumerSecret, '1.0', config.callbackUrl, 'HMAC-SHA1');

function socketConnectIo(server) {
    var listener;

    listener = io.listen(server);
    listener.on('connection', function(client)
    {
        try {
            // TODO: Make this official, not a creds hack
            creds[client.sessionId]           = client.user || {};
            creds[client.sessionId].timestamp = new Date().getTime();

            // EVENT: user has sent a message with either credentials or a message
            client.on('message', function(clientRes)
            {
                // Server can receive either credentials or a message to share
                if ('type' in clientRes && typeof clientRes.type == 'string' && clientRes.type in {'message': '', 'credentials': '', 'roomchange': ''}) {

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    // ROOM CHANGE: User is requesting to change rooms
                    if (clientRes.type == 'roomchange' && 'room' in clientRes && typeof clientRes.room == 'string' && clientRes.room.search(/^!?[a-z0-9-]{2,16}$/i) != -1) {
                        try {
                            clientRes.room = clientRes.room.toLowerCase();

                            roomCreate(clientRes.room);
                            roomUpdateUser(clientRes.room, client.sessionId);
                            roomSendInit(clientRes.room, client);
                        } catch(err) {
                            console.log('roomchange');
                            console.log(err);
                        }

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    // CREDENTIALS: passed from client with authkey to pull from PHP unix socket CREDS
                    } else if (clientRes.type == 'credentials' && 'token' in clientRes && typeof clientRes.token == 'string') {
                        try {
                            if (client.sessionId in creds) {
                                // Step 1: Get Room (Or set to main room)
                                if (!('room' in clientRes) || typeof clientRes.room != 'string' || clientRes.room.search(/^!?[a-z0-9-]{2,16}$/i) == -1) {
                                    clientRes.room = 'main';
                                } else {
                                    // They are providing a room name, make sure it exists
                                    clientRes.room = clientRes.room.toLowerCase();
                                    roomCreate(clientRes.room);
                                }

                                if (creds[client.sessionId].name in banned) {
                                    console.log('User is banned!');
                                    delete creds[client.sessionId];
                                    client.send({
                                        type:    'notice',
                                        message: 'You have been banned.'});
                                    client.connection.end();
                                    return;
                                }

                                // Step 2: Check that user isn't already in room
                                for (var i in rooms[clientRes.room].users) {
                                    if (rooms[clientRes.room].users[i].name == creds[client.sessionId].name) {
                                        roomRemoveUser(i);
                                        break;
                                    }
                                }

                                // Transfer creds to user list and delete from php server creds
                                var currentUser = creds[client.sessionId];
                                delete creds[client.sessionId];

                                // Setup user as OPERATOR if in the approval list above
                                currentUser.op          = (currentUser.name in config.ops);
                                currentUser.timestamp   = 0;
                                currentUser.lastMessage = '';

                                // Place into proper room
                                roomUpdateUser(clientRes.room, client.sessionId, currentUser);

                                roomSendInit(clientRes.room, client);

                                // Send giant list of existing rooms when user joins
                                roomNotifyInit();

                                // Broadcast to everyone that this user has connected
                                // This will also add the user to their user list
                                roomBroadcast(clientRes.room, {
                                    type: 'status',
                                    mode: 'connect',
                                    id:   client.sessionId,
                                    user: currentUser});

                            } else {
                                throw('Not in creds');
                            }
                        } catch(err) {
                            client.connection.end();
                            console.log('credentials');
                            console.log(err);
                        }

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    // MESSAGE: user is sending a message to everyone
                    } else if ('message' in clientRes && typeof clientRes.message == 'string') {
                        try {
                            var currentRoom = roomUserExists(client.sessionId);

                            if (currentRoom) {
                                var currentUser = rooms[currentRoom].users[client.sessionId];
                                var timestamp   = new Date().getTime();
                                var message     = clientRes.message.substr(0, 350);

                                if (currentUser.op) {
                                    if (message.search(/^\/shout/) == 0) {
                                        var shoutMessage = 'Server Message: ' + message.substr(7);
                                        socket.broadcast({
                                            type: 'status',
                                            message: shoutMessage});
                                        return;

                                    } else if (message.search(/^\/topic/) == 0) {
                                        var topic = message.substr(7);
                                        rooms[currentRoom].topic = topic;
                                        roomBroadcast(currentRoom, {
                                            type:  'topic',
                                            topic: topic});
                                        return;

                                    } else if (message.search(/^\/kick [a-z0-9-]+( !?[a-z0-9-]{2,16})?/i) == 0) {
                                        var split = message.split(' ');
                                        var name  = split[1];
                                        var room  = (2 in split ? split[2] : false);

                                        if (room) {
                                            var moveId = false;
                                            for (var i in rooms) {
                                                for (var j in rooms[i].users) {
                                                    if (name == rooms[i].users[j].name) {
                                                        moveId = j;
                                                        break;
                                                    }
                                                }
                                            }

                                            if (moveId) {
                                                roomCreate(room);
                                                roomUpdateUser(room, moveId);
                                                roomSendInit(room, socket.clients[moveId]);

                                                // Let everyone know that someone has been moved
                                                roomBroadcast(currentRoom, {
                                                    type: 'status',
                                                    message: 'has been kicked to #' + room + ' Room',
                                                    id: moveId});
                                            }
                                        } else {
                                            roomDropUser(currentRoom, name, 'has been kicked...');
                                        }

                                        return;

                                    } else if (message.search(/^\/ban [a-z0-9-]+( \d+)?/i) == 0) {
                                        // Get the name and duration of ban in minutes
                                        // If duration is blank, set the ban to infinity
                                        var split = message.split(' ');
                                        var name  = split[1];

                                        if (name in banned) {
                                            delete banned[name];
                                        } else {
                                            // Duration in milliseconds
                                            var duration    = (2 in split ? (timestamp + parseInt(split[2]) * 60000) : -1);
                                            var durationMsg = (duration != -1 ? ' for ' + split[2] + ' minutes' : '');
                                            banned[name]    = duration;

                                            // Tell everyone they have been banned, with possible time
                                            roomDropUser(currentRoom, name, 'has been banned' + durationMsg + '...');
                                        }
                                        return;
                                    }
                                }

                                // If there is a message and it isn't the same as their last (griefing)
                                if (message.length > 0 && (currentUser.op || (
                                        !(currentUser.name in banned) &&
                                        message != currentUser.lastMessage &&
                                        timestamp - currentUser.timestamp > 2000))) {

                                    if (message.search(/^\/away/) == 0) {
                                        roomBroadcast(currentRoom, {
                                            type:    'status',
                                            mode:    'away',
                                            id:      client.sessionId});
                                        return;
                                    }

                                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                                    // Replace repetitive characters
                                    message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

                                    // I also hate capslocking
                                    if (message.search(/[A-Z ]{6,}/) != -1) {
                                        message = message.toLowerCase();
                                    }

                                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                                    // Store last message to track griefing
                                    currentUser.timestamp   = timestamp;
                                    currentUser.lastMessage = message;

                                    // Push messages into buffer for user logins
                                    rooms[currentRoom].buffer.push({
                                        type:    'message',
                                        user:    currentUser,
                                        message: message});

                                    if (rooms[currentRoom].buffer.length > 15) {
                                        rooms[currentRoom].buffer.shift();
                                    }

                                    // Broadcast message to everyone
                                    roomBroadcast(currentRoom, {
                                        type:    'message',
                                        id:      client.sessionId,
                                        message: message});
                                }
                            }
                        } catch(err) {
                            console.log('message');
                            console.log(err);
                        }

                    } else {
                        // Invalid message type sent, disconnect user
                        console.log('invalid message');
                        console.log(clientRes);
                    }

                } else {
                    // Invalid properties sent, disconnect user
                    console.log('invalid type');
                    console.log(clientRes);
                }
            });

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // EVENT: Disconnect
            //
            client.on('disconnect', function()
            {
                try {
                    roomRemoveUser(client.sessionId);

                } catch(err) {
                    // Something didn't work during disconnect
                    console.log('Unable to Disconnect');
                    console.log(err);
                }
            });
        } catch(err) {
            // Something didn't work during disconnect
            console.log('Unable to Connect');
            console.log(err);
        }
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup featured rooms that last forever
    //
    roomCreateFeatured({'main': '', 'spam': '', 'german': '', 'italian': '', 'japanese': '', 'spanish': '', 'tagalog': ''});

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // TODO: DOCUMENT EVERYTHING ELSE
    //
    function roomUserExists(sessionId) {
        for (var i in rooms) {
            if (sessionId in rooms[i].users) {
                return i;
            }
        }
        return false;
    }

    function roomSendInit(room, client)
    {
        client.send({
            type:   'approved',
            id:     client.sessionId,
            room:   room,
            topic:  rooms[room].topic,
            buffer: rooms[room].buffer,
            users:  rooms[room].users});
    }

    function roomRemoveUser(sessionId)
    {
        // Find user in its previous room and remove it
        for (var i in rooms) {
            if (sessionId in rooms[i].users) {
                var oldUser = rooms[i].users[sessionId];

                delete rooms[i].users[sessionId];
                rooms[i].userCount--;
                console.log(sessionId + ' removed from room ' + i);

                // Delete empty rooms (Except for main room)
                if (!rooms[i].featured && rooms[i].userCount <= 0) {
                    delete rooms[i];
                    roomCount--;
                    console.log('room ' + i + ' deleted');

                    roomNotifyDelete(i);
                } else {
                    roomBroadcast(i, {
                        type: 'status',
                        mode: 'disconnect',
                        id:   sessionId});

                    if (!rooms[i].hidden) {
                        roomNotifyChange(i, rooms[i].userCount, rooms[i].featured);
                    }
                }

                return oldUser;
            }
        }

        return false;
    }

    function roomNotifyDelete(roomName)
    {
        listener.broadcast({
            type: 'room',
            mode: 'delete',
            room: roomName});
    }

    function roomNotifyChange(roomName, userCount, featured)
    {
        listener.broadcast({
            type: 'room',
            mode: 'change',
            room: roomName,
            count: userCount,
            featured: featured});
    }

    function roomNotifyInit()
    {
        for (var i in rooms) {
            if (!rooms[i].hidden) {
                roomNotifyChange(i, rooms[i].userCount, rooms[i].featured);
            }
        }
    }

    function roomCreate(roomName, featured)
    {
        // If Room does not exist, CREATE IT
        if (!(roomName in rooms)) {
            rooms[roomName] = {
                topic:     'Anything',
                buffer:    [],
                users:     {},
                userCount: 0,
                featured:  featured,
                hidden:    (roomName.substr(0, 1) == '!')};
            roomCount++;
            console.log(roomName + ' created.');

            if (!rooms[roomName].hidden) {
                roomNotifyChange(roomName, 0, rooms[roomName].featured);
            }
        }
    }

    function roomCreateFeatured(roomNames) {
        for (var i in roomNames) {
            roomCreate(i, true);
        }
    }
    function roomUpdateUser(roomName, sessionId, newUser)
    {
        // If user is not moving to the same room
        if (!(sessionId in rooms[roomName].users)) {
            var oldUser = roomRemoveUser(sessionId);
            var user    = newUser ? newUser : oldUser;

            rooms[roomName].users[sessionId] = user;
            rooms[roomName].userCount++;
            console.log(user.name + ' added to room ' + roomName);

            roomBroadcast(roomName, {
                type: 'status',
                mode: 'connect',
                id:   sessionId,
                user: user});

            if (!rooms[roomName].hidden) {
                roomNotifyChange(roomName, rooms[roomName].userCount, rooms[roomName].featured);
            }
        }
    }

    function roomBroadcast(roomName, object)
    {
        for (var i in rooms[roomName].users) {
            if (i in listener.clients) {
                listener.clients[i].send(object);
            } else {
                roomRemoveUser(i);
            }
        }
    }

    function roomDropUser(roomName, name, message)
    {
        for (var j in rooms[roomName].users) {
            // You cannot ban or kick OPs
            if (rooms[roomName].users[j].name == name && !rooms[roomName].users[j].op) {
                // Broadcast to everyone that this user has disconnected
                // This will remove user from their list
                roomBroadcast(roomName, {
                    type:    'status',
                    message: message,
                    id:      j});

                // Remove user and last grief from server
                listener.clients[j].connection.end();
                return;
            }
        }
    }

    // Perform memoery cleanup on everything
    setInterval(function()
    {
        try {
            roomCount = 0;
            userCount = 0;

            var credCount = 0,
                timestamp = new Date().getTime();

            for (i in creds) {
                if (timestamp - creds[i].timestamp > 5000) {
                    delete creds[i];
                } else {
                    credCount++;
                }
            }

            for (i in rooms) {
                rooms[i].userCount = 0;

                for (j in rooms[i].users) {
                    if (j in listener.clients) {
                        rooms[i].userCount++;
                    } else {
                        delete rooms[i].users[j];
                    }
                }

                if (rooms[i].userCount != 0 || rooms[i].featured) {
                    userCount += rooms[i].userCount;
                    roomCount++;
                } else {
                    delete rooms[i];
                }
            }

            for (i in banned) {
                if (banned[i] != -1 && banned[i] < timestamp) {
                    delete banned[i];
                    console.log(i + ' has been unbanned');
                }
            }
        } catch(err) {
            console.log('Error with data cleanup');
            console.log(err);
        }
    }, 60000);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Connect Handler, must skip to next() on failure else allow 'upgrade' responses
    //
    var handler = function(req, res, next)
    {
        if (req.upgrade) {
            if (!listener.check(req, res, true, req.head)) {
                res.end();
                res.destroy();
            }
        } else if (!listener.check(req, res)) {
            next();
        }
    };

    return handler;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Create a CONNECT server, add routes for a main page to start chat and a callback
//
// On INDEX: if no user in session, get Tumblr authorization routed to /callback
//           otherwise, start chat server based on user name
//
// On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
//
var server = connect.createServer(
    // connect.cache(),
    // connect.gzip(),
    connect.cookieDecoder(),
    connect.session({fingerprint: function(req)
    {
        return connect.utils.md5(req.socket.remoteAddress);
    }}),
    connect.staticProvider(__dirname + '/../website'),
    connect.router(function(app)
    {
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Index Page (If user exists, start chat)
        //
        app.get('/', function(req, res)
        {
            if (!('user' in req.session)) {
                oa.getOAuthRequestToken(function(error, token, secret, results)
                {
                    req.session.secret = secret;

                    res.writeHead(303, {'Location': config.authorizeUrl + '?oauth_token=' + token});
                    res.end();
                });
            } else {
                fs.readFile(__dirname + '/index.html', function(err, data) {
                    if (!err) {
                        res.writeHead(200, {'Content-type': 'text/html'});
                        res.end(data);                        
                    }
                });
            }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Callback Page (Parse XML from Tumblr Authenticate, store user in session, redirect to index)
        //
        app.get('/callback', function(req, res)
        {
            var parsedUrl = url.parse(req.url, true);

            oa.getOAuthAccessToken(parsedUrl.query.oauth_token, req.session.secret, parsedUrl.query.oauth_verifier, function(error, token, secret, results)
            {
                oa.getProtectedResource(config.authenticateUrl, 'POST', token, secret, function(error, data)
                {
                    res.writeHead(200, {
                        'Content-type': 'text/html'});

                    if (typeof data == 'string') {
                        var parser = new xml2js.Parser();

                        parser.addListener('end', function(result)
                        {
                            if ('tumblelog' in result) {
                                var tumblr = (0 in result['tumblelog'] ? result['tumblelog'][0] : result['tumblelog']);

                                if ('@' in tumblr && 'name' in tumblr['@']) {
                                    req.session.user = {
                                        'name':   tumblr['@']['name'],
                                        'title':  tumblr['@']['title'],
                                        'url':    tumblr['@']['url'],
                                        'avatar': tumblr['@']['avatar-url'].replace(/_128\./, '_16.')
                                    }
                                    
                                    res.writeHead(303, {
                                        'Location': '/'});
                                    res.end();
                                }
                            }
                        });

                        parser.parseString(data);
                    } else {
                        res.end('Error connecting.');
                    }
                });
            });
        });
    })
);

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Attach Socket.IO to Connect, then start listening on port 8080
//
server.use('', socketConnectIo(server));
server.listen(8080);