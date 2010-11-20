exports.index = function(app)
{
    app.get('/', function(req, res, next)
    {
        if (!('user' in req.session)) {
            oa.getOAuthRequestToken(function(error, token, secret, results)
            {
                req.session.secret = secret;

                res.writeHead(303, {
                    'Location': config.authorizeUrl + '?oauth_token=' + token});
                res.end();
            });
        } else {
            res.writeHead(200, {
                'Content-type': 'text/html'});
            res.end('Start chatting ' + req.session.user.name);
        }
    });
}