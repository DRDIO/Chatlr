var mongojs = require('mongojs'),
    config  = require('../conf/db.conf');

module.exports = mongojs.connect(config.db, config.collections);