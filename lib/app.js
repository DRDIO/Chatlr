process.on('uncaughtException', function (exception) {
    console.log(exception.type);
    console.log(exception.message);
});

module.exports = require('./appevent');