var config = require('../conf/app.conf'),
    Sioa   = require('socketioauth');

new Sioa(config);
