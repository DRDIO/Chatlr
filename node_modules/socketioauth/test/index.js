// Socket.IO OAuth example with Tumblr

var sioa = require('../socketioauth')({
  'host':    null,
  'port':    8080,
  'secret':  'XXXX',

  'protocol':        'http://',
  'domain':          'DOMAINNAME.COM:PORT',
  'requestUrl':      'http://www.tumblr.com/oauth/request_token',
  'accessUrl':       'http://www.tumblr.com/oauth/access_token',
  'authorizeUrl':    'http://www.tumblr.com/oauth/authorize',
  'authenticateUrl': 'http://api.tumblr.com/v2/user/info',

  'consumerKey':     'XXXX',
  'consumerSecret':  'XXXX',
  'callbackUrl':     '/callback',

  'websitePath': '/public',
  'appHtmlPath': '/index.html',
});
