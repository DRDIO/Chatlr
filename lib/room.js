var _     = require('underscore'),
    Class = require('./class');

module.exports = Class.extend({
    userList:  {},
    topic:     '',
    buffer:    [],
    featured:  false,
    hidden:    false,

    init: function(name, featured)
    {
        this.name     = this.parseName(name);
        this.featured = featured || false;
        this.hidden   = this.isHidden(name);

        console.log(roomName + ' created.');
    },

    parseName: function(name)
    {
        return name.toLowerCase().replace(/[^a-z0-9]+/ig, '-');
    },

    isHidden: function(name)
    {
        return name.substr(0, 1) == '!';
    },

    getUserList: function()
    {
        return _.keys(this.userList);
    }
});