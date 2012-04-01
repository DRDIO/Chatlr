var _     = require('underscore'),
    Class = require('.//src/class'),
    User  = require('./user');

module.exports = Class.extend({
    // Two different ways to access users (point to same reference)
    uidList: {},
    sidList: {},

    init: function(list)
    {
        for (var uid in list) {
            var user = new User(uid);

            if (user.name) {
                this.uidList[user.uid] = user;
            }
        }
    },

    isUser: function(uid, isSid)
    {
        if (isSid) {
            return this.sidList[uid] || null;
        } else {
            return this.uidList[uid] || null;
        }
    },

    addUser: function(config)
    {
        var user = new User(config);
        if (user.uid) {
            this.uidList[user.uid] = user;
            this.sidList[user.sid] = user;
        } else {
            console.log('invalid user id');
        }

        return this.uidList[user.uid];
    },

    getList: function()
    {
        return _.keys(this.uidList);
    }
});