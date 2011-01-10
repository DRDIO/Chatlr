// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Error catching!
//
process.on('uncaughtException', function (err) {
  console.log(err.message);
  console.log(err.stack);
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Get Required Components
//
var config   = require('../config/config'),
    connect  = require('./connect/lib/connect'),
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
    socket(function() { return server; }),
    connect.cookieDecoder(),
    connect.session({fingerprint: function(req) {
        return '';
    }}),
    connect.staticProvider(__dirname + '/../website'),
    connect.router(redirect)
);

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Attach Socket.IO to Connect, then start listening on port 8080
//
server.listen(config.port, config.ipaddr);
