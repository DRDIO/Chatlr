var _     = require('underscore'),
    Class = require('./class'),
    User  = require('./user');

module.exports = Class.extend({
    list: {},

    init: function(list)
    {
        for (var uid in list) {
            var user = new User(uid);

            if (user.name) {
                this.list[user.uid] = user;
            }
        }
    },

    isUser: function(uid)
    {
        return this.list[uid] || null;
    },

    addUser: function(config)
    {
        var user = new User(config);
        if (user.uid) {
            this.list[user.uid] = user;
        }

        return this.list[user.uid];
    },

    getList: function()
    {
        return _.keys(this.list);
    }
});