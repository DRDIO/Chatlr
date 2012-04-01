exports.interval = 10000;
exports.intIdle  = 300000;
exports.intKick  = 1800000;

exports.chatOps = {
    'kevinnuut':     '',
    'lacey':         '',
    'gompr':         '',
    'topherchris':   '',
    'brittanyforks': '',
    'fajita':        ''
};

exports.chatRooms = {
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
    host:       '0.0.0.0',
    port:       process.env.PORT,
    secret:     'sauce1!',
    publicPath: __dirname + '/../website'
};

exports.oauth = {
    protocol:        'http://',
    domain:          'chatlr.kevinnuut.c9.io',

    requestUrl:      'http://www.tumblr.com/oauth/request_token',
    accessUrl:       'http://www.tumblr.com/oauth/access_token',
    authorizeUrl:    'http://www.tumblr.com/oauth/authorize',
    authenticateUrl: 'http://api.tumblr.com/v2/user/info',

    consumerKey:     'BgIkIo9ReF5A5VSFNwNmtY8EHoYqw3KWA3ScKxCMHHNxi0DLxm',
    consumerSecret:  'z7FMJmNa34wHsokEfyiK1OCFArY1KWX1MprmXz1uMjJ6OG9P4A',
    callbackUrl:     'http://chatlr.kevinnuut.c9.io/callback',

    appHtmlPath:     exports.server.webPath + '/content.html'
};

exports.socketio = {
    logLevel: 2
};