var _     = require('underscore'),
    Class = require('./src/class');

var Room = {
    name:      null,
    userList:  null,
    topic:     '',
    buffer:    null,
    featured:  false,
    hidden:    false,

    init: function(name, featured, topic)
    {
        this.name     = this.parseName(name);
        this.featured = featured || false;
        this.hidden   = name.substr(0, 1) == '!';
        this.buffer   = [];
        this.userList = {};
        this.topic    = topic || '';

        console.log(this.name + ' created.');
    },

    parseName: function(name)
    {
        // Rewrite malformed pages to preserve page creation
        var saneName = name.toLowerCase().replace(/[^a-z0-9]+/ig, '-').replace(/(^-|-$)/ig, '') || '';

        if (name.substr(0,1) == '!') {
            saneName = '!' + saneName;
        }
        
        return saneName;
    },

    isFeatured: function(featured)
    {
        if (!_.isUndefined(featured)) {
            this.featured = featured;
        }
        
        return this.featured;
    },
    
    isTopic: function(topic)
    {
        if (!_.isUndefined(topic)) {
            this.topic = topic;
        }
        
        return this.topic;
    },    

    isHidden: function(hidden)
    {
        if (!_.isUndefined(hidden)) {
            this.hidden = hidden;
        }
        
        return this.hidden;
    },

    getUserCount: function()
    {
        return _.keys(this.userList).length;
    },
    
    getUserList: function(isClient)
    {
        // Supply a smaller package for the client
        if (isClient) {
            var list = {};
            var time = (new Date).getTime();
            
            for (var i in this.userList) {
                list[i] = {
                    name:   this.userList[i].name,
                    op:     this.userList[i].op,
                    avatar: this.userList[i].avatar,
                    url:    this.userList[i].url,
                    title:  this.userList[i].title
                };
            }
            
            console.log('TIMER: Room Get User List: ' + time + ' to ' + (new Date).getTime());

            return list;
        } else {
            return this.userList;
        }
    },
    
    hasUser: function(user)
    {
        return this.userList[user.uid] || null;
    },
    
    addUser: function(user)
    {
        console.log('adding user ' + user.uid + ' to ' + this.name);
        
        this.userList[user.uid] = user;
        
        return this.userList[user.uid];
    },
    
    removeUser: function(user)
    {
        console.log('removing user ' + user.uid + ' to ' + this.name);
        
        delete this.userList[user.uid];
    },
    
    bufferMessage: function(user, message) {
        // Push messages into buffer for user logins
        this.buffer.push({
            type:    'message',
            user:    user.getSimple(),
            message: message});

        if (this.buffer.length > 15) {
            this.buffer.shift();
        }        
    }    
};


module.exports = Class.extend(Room);