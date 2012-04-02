var fs     = require('fs'),
    oauth  = require('oauth');

module.exports = function(server, config)
{
    var oa = new oauth.OAuth(config.requestUrl, config.accessUrl, config.consumerKey, config.consumerSecret, '1.0', config.callbackUrl, 'HMAC-SHA1');

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Callback Page (Parse JSON from Tumblr Authenticate, store user in session, redirect to index)
    //
    server.get('/callback', function(req, res)
    {
        console.log('in callback, trying out oauth');

        if ('oauth_token' in req.query && 'oauth_verifier' in req.query) {
            oa.getOAuthAccessToken(req.query.oauth_token, req.session.secret, req.query.oauth_verifier, function(error, token, secret, results)
            {
                console.log('oauth token received');

                // Get Authentication Information
                oa.getProtectedResource(config.authenticateUrl, 'POST', token, secret, function(error, data)
                {
                    console.log('oauth authentication received');

                    // Make sure we get actual data
                    if (typeof data == 'string') {
                        var result = JSON.parse(data);

                        if ('response' in result && 'user' in result.response) {
                            var blog;
                            for (var count in result.response.user.blogs) {
                                if (result.response.user.blogs[count].primary) {
                                    blog = result.response.user.blogs[count];
                                    break;
                                }
                            }

                            req.session.user = {
                                'uid':    result.response.user.name,
                                'name':   blog.name,
                                'title':  blog.title,
                                'url':    blog.url,
                                'avatar': 'http://api.tumblr.com/v2/blog/' + blog.name + '.tumblr.com/avatar/16',
                                'blogs':  result.response.user.blogs
                            };

                            res.writeHead(303, {'Location': '/' + (req.session.page || '')});
                            res.end();
                        }
                    } else {
                        var message = (error.data || 'Invalid response from Tumblr') + ' (C2).';
                        res.writeHead(200, {'Content-type': 'text/html'});
                        res.end(message);
                    }
                });
            });
        } else {
            res.writeHead(200, {'Content-type': 'text/html'});
            res.end('The callback did not conntain a login key (C1).');
        }
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Clear out user and refresh entire session
    //
    server.get('/clear', function(req, res) {
        delete req.session.user;
        console.log('/clear');

        res.writeHead(303, {'Location': '/'});
        res.end();
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Index Page (If user exists, start chat)
    //
    server.get('/:page?', function(req, res)
    {
        console.log('page requested');

        try {
            // Rewrite malformed pages to preserve page creation
            var page     = req.params.page || '',
                sanePage = page.toLowerCase().replace(/[^a-z0-9]+/ig, '-').replace(/(^-|-$)/ig, '') || '';

            if (page.substr(0,1) == '!') {
                sanePage = '!' + sanePage;
            }
            
            if (page != sanePage) {
                res.writeHead(303, {'Location': '/' + sanePage});
                res.end();
            } else {
                // Store the page for when callback occurs
                req.session.page = sanePage;

                if (!('user' in req.session)) {
                    oa.getOAuthRequestToken(function(error, token, secret, results)
                    {
                        req.session.secret = secret;
                        res.writeHead(303, {'Location': config.authorizeUrl + '?oauth_token=' + token});
                        res.end();
                    });
                } else {
                    fs.readFile(config.appHtmlPath, function(err, data) {
                        if (!err) {
                            res.writeHead(200, {'Content-type': 'text/html'});
                            res.end(data || '');
                        } else {
                            res.writeHead(200, {'Content-type': 'text/html'});
                            res.end('Unable to load application.');
                        }
                    });
                }
            }
        } catch(err) {
            console.log(err.message);
            console.log(err.stack);

            res.writeHead(200, {'Content-type': 'text/html'});
            res.end('Unable to redirect TumblrChat (R1).');
        }
    });
};
