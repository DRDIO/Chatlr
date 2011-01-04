// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Error catching!
//
process.on('uncaughtException', function (err) {
  console.log(err.message);
  console.log(err.stack);
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Too lazy to figure out npm, so add required paths
//
var config  = require('../config/config'),
    connect = require('./connect/lib/connect'),
    socket  = require('./socketconnect/socketIO.js'),
    chat    = require('./chat');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Create a CONNECT server, add routes for a main page to start chat and a callback
//
// On INDEX: if no user in session, get Tumblr authorization routed to /callback
//           otherwise, start chat server based on user name
//
// On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
//
var server = connect.createServer(
    chat(function() { return server; }),
    connect.cookieDecoder(),
    connect.session({fingerprint: function(req) {
        return '';
    }}),
    connect.staticProvider(__dirname + '/../website'),
    connect.router(require('./redirect'))
);

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Attach Socket.IO to Connect, then start listening on port 8080
//
server.listen(config.port, config.ipaddr);
