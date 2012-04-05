
var Utils = {
    filterMessage: function(message) {
        // Replace repetitive characters
        message = message.replace(/(.+?)\1{4,}/g, '$1$1$1$1');

        // I also hate capslocking
        if (message.search(/[A-Z ]{6,}/) != -1) {
            message = message.toLowerCase();
        }

        return message;        
    }
}

module.exports = Utils;