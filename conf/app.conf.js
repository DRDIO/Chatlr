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

exports.opList = {
    'kevinnuut':     0,
    'lacey':         1,
    'gompr':         1,
    'topherchris':   1,
    'brittanyforks': 1,
    'fajita':        1
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
    protocol:        'http://',
    domain:          'tumblrchat.loc:8080',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'svbT4DJfa0G1LDo4BkFlxPhlshIIYzrOoE1IWieuww0fS07P21',
    consumerSecret:  'TpF7X2GIWV2duq7g2sHijZ64QMNtvfB7i050zyiDvkhw6aC8Sk',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.oauth.callbackUrl = exports.oauth.protocal + exports.oauth.domain + '/callback';

exports.socketio = {
    logLevel: 2
};
