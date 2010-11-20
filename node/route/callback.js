exports.callback = function(app)
{
    app.get('/callback', function(req, res, next)
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
}