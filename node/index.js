try {
    // // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Get Required Components
    //
    var config   = require('../config/config'),
        connect  = require('./connect/lib/connect'),
        memory   = require('./connect/lib/connect/middleware/session/memory')
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
    var server = connect.createServer(
        function(req, res, next) {
            var hostParts = req.headers.host.split('.');
            if (hostParts.length > 2) {
                // OAuth only correctly returns if using the same domain as callback (no www)
                var host = 'http://' + hostParts.slice(-2).join('.') + req.originalUrl;                
                res.writeHead(303, {'Location': host});
                res.end();
            } else {
                next();
            }
        },
        socket(function() { return server; }),
        connect.cookieDecoder(),
        connect.session({
            store: new memory({
                reapInterval: 60000 * 10,
                maxAge: 60000 * 60 * 12,
                cookie: {
                    path: '/',
                    httpOnly: false
                }
            })
        }),
        connect.staticProvider(__dirname + '/../website'),
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
