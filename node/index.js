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
    connect = require('./connect/lib/connect');

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Create a CONNECT server, add routes for a main page to start chat and a callback
//
// On INDEX: if no user in session, get Tumblr authorization routed to /callback
//           otherwise, start chat server based on user name
//
// On CALLBACK: Authenticate with Tumblr, parse XML, store user in a session
//
var server = connect.createServer(
    connect.cookieDecoder(),
    connect.session({fingerprint: function(req)
    {
        return connect.utils.md5(req.socket.remoteAddress);
    }}),
    connect.staticProvider(__dirname + '/../website'),
    connect.router(require('./redirect'))
);

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Attach Socket.IO to Connect, then start listening on port 8080
//
server.use('', require('./chat')(server));
server.listen(config.port);
