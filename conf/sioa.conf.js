// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Configuration Variables, YAY!
//
exports.ipaddr   = '0.0.0.0';
exports.port     = process.env.PORT;
exports.secret  = 'sauce';

exports.protocol        = 'http://';
exports.domain          = 'chatlr.kevinnuut.c9.io';
exports.requestUrl      = 'http://www.tumblr.com/oauth/request_token';
exports.accessUrl       = 'http://www.tumblr.com/oauth/access_token';
exports.authorizeUrl    = 'http://www.tumblr.com/oauth/authorize';
exports.authenticateUrl = 'http://api.tumblr.com/v2/user/info';

exports.consumerKey    = 'BgIkIo9ReF5A5VSFNwNmtY8EHoYqw3KWA3ScKxCMHHNxi0DLxm';
exports.consumerSecret = 'z7FMJmNa34wHsokEfyiK1OCFArY1KWX1MprmXz1uMjJ6OG9P4A';
exports.callbackUrl    = exports.protocol + exports.domain + '/callback';

exports.websitePath    = __dirname + '/../website';
exports.appHtmlPath    = exports.websitePath + '/content.html';

exports.logLevel       = 2;
