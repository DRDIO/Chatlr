var cls = require('./class'),
    Entity = cls.extend({
        init: function(message) {
            this.message = message;
        },
        shout: function() {
            console.log(this.message);
        }
    });

var test = new Entity('meow');

test.shout();