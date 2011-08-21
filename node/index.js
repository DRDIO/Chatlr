var sioaConfig = require('../config/socketioauth.js'),
    appConfig  = require('../config/app.js'),
    app        = require('./app'),
    socketio   = require('./socketioauth');
    
// Start the app, passing the socket object into it    
app(socketio(sioaConfig), appConfig);