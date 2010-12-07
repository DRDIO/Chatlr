// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Chat variables
//
var io     = require('./extension'),
    config = require('../config/config');
    
module.exports = function(server) {
    // Create a socket to IO and start listening
    var listener = io.listen(server, {transports: ['websocket', 'htmlfile', 'xhr-polling']});

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup featured listener.chatRooms that last forever
    //
    listener.roomCreateFeatured(config.chatRooms);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Setup all events and attach chat methods
    //
    listener.on('connection', function(client)
    {
        listener.chatConnection(client);
        client.on('message', listener.chatMessage);
        client.on('disconnect', listener.chatDisconnect);
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Perform memoery cleanup on everything
    //
    setInterval(function() {
        listener.chatClean(listener);
    }, config.interval);

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Connect Handler, must skip to next() on failure else allow 'upgrade' responses
    //
    return function(req, res, next)
    {
        if (req.upgrade) {
            if (!listener.check(req, res, true, req.head)) {
                console.log('Ending response due to invalid check');
                res.end();
                res.destroy();
            }
        } else if (!listener.check(req, res)) {
            next();
        }
    };
};