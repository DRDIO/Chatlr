// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Error catching!
//
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Too lazy to figure out npm, so add required paths
//
require.paths.unshift('/www/tumblrchat/node');
require.paths.unshift('/www/tumblrchat/node/sax/lib');
require.paths.unshift('/www/tumblrchat/node/xml2js/lib');
require.paths.unshift('/www/tumblrchat/node/oauth/lib');

var config  = require('config'),
    connect = require('connect'),
    url     = require('url'),
    fs      = require('fs'),
    xml2js  = require('xml2js'),
    oauth   = require('oauth'),
    io      = require('./socket.io');

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
    listener.on('connection', function(client) {
        console.log('connection');
    });
    
    var handler = function(req, res, next)
    {
        if (req.upgrade) {
            if (!listener.check(req, res, true, req.head)) {
                res.end();
                res.destroy();
            } else {
                req.client.user = req.session.user;
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

server.use('', socketConnectIo(server));
server.listen(8080);