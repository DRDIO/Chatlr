// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Configuration Variables, YAY!
//
exports.host    = null;
exports.port    = 8080;
exports.secret  = 'sauce';

exports.protocol        = 'http://';
exports.domain          = 'tumblrchat.loc:8080';
exports.requestUrl      = 'http://www.tumblr.com/oauth/request_token';
exports.accessUrl       = 'http://www.tumblr.com/oauth/access_token';
exports.authorizeUrl    = 'http://www.tumblr.com/oauth/authorize';
exports.authenticateUrl = 'http://api.tumblr.com/v2/user/info';

exports.consumerKey    = 'svbT4DJfa0G1LDo4BkFlxPhlshIIYzrOoE1IWieuww0fS07P21';
exports.consumerSecret = 'TpF7X2GIWV2duq7g2sHijZ64QMNtvfB7i050zyiDvkhw6aC8Sk';
exports.callbackUrl    = exports.protocol + exports.domain + '/callback';

exports.websitePath    = '/../../website';
exports.appHtmlPath    = '/../app/index.html';

exports.logLevel       = 2;