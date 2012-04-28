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
    'database': 'chatlrdev'
};

exports.server = {
    host:       '',
    port:       8080,
    secret:     'sauce1!',
    publicPath: __dirname + '/../website'
};

exports.oauth = {
    domain:          'http://chatlr.com:8080',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'k6huAUe0DtDSdmIRHxnDGNuTBScw7ffJ0ePAi6tsbjSgZTzF9P',
    consumerSecret:  'jWwSLvLTqKDQMDeTGYrhWeUVApk2FufivWmkn3RS8VhFOvTE2h',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};
