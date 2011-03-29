process.on('uncaughtException', function (err) {
    console.log(err.message);
    console.log(err.stack);
});

try {
    // // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Get Required Components
    //
    var config   = require('../config/config'),
        connect  = require('./connect/lib/connect'),
        memory   = require('./connect/lib/middleware/session/memory')
        socket   = require('./socketconnect'),
        redirect = require('./redirect');

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Create a CONNECT server, add routes for a main page to start chat and a callback
    //
    // On INDEX: if no user in session, get Tumblr authorization routed to /callback
    //           otherwise, start chat server based on user name
    //
    // On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
    //
    var store  = new memory();
    var server = connect.createServer(
        function(req, res, next) {
            if (req.headers.host != config.domain) {
                // OAuth only correctly returns if using the same domain as callback (no www)
                var host = config.protocol + config.domain + req.originalUrl;
                res.writeHead(303, {'Location': host});
                res.end();
            } else {
                next();
            }
        },        
        connect.cookieParser(),
        connect.session({
            secret: config.sessionSecret,
            store: store,
            cookie: {
                maxAge: 60000 * 60 * 12,
                path: '/',
                httpOnly: false
            }
        }),
        socket(function() { return server; }, store),
        connect.static(__dirname + '/../website'),
        connect.router(redirect)
    );

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Attach Socket.IO to Connect, then start listening on port 8080
    //
    server.listen(config.port, config.ipaddr);
} catch (err) {
    console.log(err.message);
    console.log(err.stack);
}
