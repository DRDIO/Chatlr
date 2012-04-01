exports.interval = 10000;
exports.intIdle  = 300000;
exports.intKick  = 1800000;

exports.opLevel = {
    0: 'owner',
    1: 'admin',
    2: 'moderator'
};

exports.opList = {
    'kevinnuut':     0,
    'lacey':         1,
    'gompr':         1,
    'topherchris':   1,
    'brittanyforks': 1,
    'fajita':        1
};

exports.roomList = {
    'english':  '',
    'spam':     '',
    'italian':  '',
    'spanish':  '',
    'tagalog':  ''
};

exports.db = {
    'database': 'mongodb://chatlr:sandbox@flame.mongohq.com:27099/chatlr',
    'collections': [
        'room',
        'user'
    ]
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
    callbackUrl:     'http://tumblrchat.loc:8080/callback',

    appHtmlPath:     exports.server.publicPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};
