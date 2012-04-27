exports.db = {
    'database': 'YOURMONGODB'
};

exports.server = {
    host:       '',
    port:       8080,
    secret:     'YOURSECRET',
    publicPath: __dirname + '/../website'
};

exports.oauth = {
    domain:          'http://YOURDOMAINNAME',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'YOUROAUTHKEY',
    consumerSecret:  'YOUROAUTHSECRET',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};
