exports.timerList = {
    cleanup: 2.5 * 60000,
    remove:  2.5 * 60000,
    idle:    5   * 60000,
    kick:    20  * 60000        
};

exports.dft = {
    room:  'main',
    owner: ''
};

exports.db = {
    'database': 'chat'
};

exports.server = {
    host:       '',
    port:       8080,
    secret:     'XXXX',
    publicPath: __dirname + '/../website'
};

exports.oauth = {
    domain:          'http://tumblrchat.loc:8080',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'XXXX',
    consumerSecret:  'XXXX',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};
