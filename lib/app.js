process.on('uncaughtException', function (err) {
    console.log(err.stack || err.message || err);
});

module.exports = require('./appevent');