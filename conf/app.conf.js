exports.timerList = {
    cleanup: 2.5 * 60000,
    remove:  2.5 * 60000,
    idle:    5   * 60000,
    kick:    20  * 60000        
};

exports.dft = {
    room:  'main',
    owner: 'kevinnuut'
};

exports.db = {
    'database': 'chatlr'
};

exports.server = {
    host:       '',
    port:       80,
    secret:     'pantspants1!',
    publicPath: __dirname + '/../website'
};

exports.oauth = {
    domain:          'http://chatlr.com',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'oQRq1Wpo1BiygSFYGdUJUZq2DgcRzm4Jjx7ooxh19wQ3WCAcSU',
    consumerSecret:  'Ak59AnEOWHWpgbtzqJYJL08IIQ8DNxA96CbsBh5FJDpMDbiij0',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};
