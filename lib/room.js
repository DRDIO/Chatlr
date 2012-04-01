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

        console.log(this.name + ' created.');
    },

    parseName: function(name)
    {
        return name.toLowerCase().replace(/[^a-z0-9]+/ig, '-');
    },

    isHidden: function(name)
    {
        return name.substr(0, 1) == '!';
    },

    getUserList: function(isClient)
    {
        // Supply a smaller package for the client
        if (isClient) {
            var list = {};
            for (var i in this.userList) {
                list[i] = {
                    name:   this.userList[i].name,
                    op:     this.userList[i].op,
                    avatar: this.userList[i].avatar,
                    url:    this.userList[i].url,
                    title:  this.userList[i].title,
                };
            }

            return list;
        } else {
            return this.userList;
        }
    },
    
    addUser: function(user)
    {
        this.userList[user.uid] = user;
    }
});