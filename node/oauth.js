// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Too lazy to figure out npm, so add required paths
require.paths.unshift('/www/tumblrchat/node/sax/lib');
require.paths.unshift('/www/tumblrchat/node/xml2js/lib');
require.paths.unshift('/www/tumblrchat/node/oauth/lib');
require.paths.unshift('/www/tumblrchat/node/socket.io/lib');

var connect = require('connect');
var url     = require('url');
var xml2js  = require('xml2js');

require.paths.unshift('support');
var oauth = require('oauth');
var oa    = new oauth.OAuth('http://www.tumblr.com/oauth/request_token',
    'http://www.tumblr.com/oauth/access_token',
    'svbT4DJfa0G1LDo4BkFlxPhlshIIYzrOoE1IWieuww0fS07P21',
    'TpF7X2GIWV2duq7g2sHijZ64QMNtvfB7i050zyiDvkhw6aC8Sk',
    '1.0',
    'http://tumblrchat.loc:4000/callback',
    'HMAC-SHA1');

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
    connect.session(),
    connect.router(function(app)
    {
        app.get('/', function(req, res, params)
        {
            if (!('user' in req.session)) {
                oa.getOAuthRequestToken(function(error, token, secret, results)
                {
                    req.session.secret = secret;

                    res.writeHead(303, {
                        'Location': 'http://www.tumblr.com/oauth/authorize?oauth_token=' + token});
                    res.end();
                });
            } else {
                res.writeHead(200, {
                    'Content-type': 'text/html'});
                res.end('Start chatting ' + req.session.user.name);
            }
        });

        app.get('/callback', function(req, res, params)
        {
            var parsedUrl = url.parse(req.url, true);

            oa.getOAuthAccessToken(parsedUrl.query.oauth_token, req.session.secret, parsedUrl.query.oauth_verifier, function(error, token, secret, results)
            {
                oa.getProtectedResource('http://www.tumblr.com/api/authenticate', 'POST', token, secret, function(error, data)
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
                                        'Location': 'http://tumblrchat.loc:4000/'});
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
    }
));

server.listen(4000);