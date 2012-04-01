var _     = require('underscore'),
    Class = require('./src/class');

module.exports = Class.extend({    
    uid:            null,
    sid:            null,
    name:           null,
    title:          null,
    url:            null,
    avatar:         null,

    op:             false,
    banned:         false,

    connected:      true,
    lastMessage:    '',
    tsMessage:      null,
    tsConnect:      null,
    tsDisconnect:   null,
    idle:           false,

    room:           null,
    blogList:       null,

    init: function(config)
    {
        var time = new Date().getTime();

        // UID is usually their name but we need to start using UID for all mapping
        this.uid      = config.uid;
        this.name     = config.name   || this.uid;
        this.title    = config.title  || this.name;
        this.url      = config.url    || null;
        this.avatar   = config.avatar || null;
        this.blogList = config.blogs  || null;

        // Otherwise initialize additional vars
        this.lastMessage  = '';
        this.tsConnect    = time;
        this.idle         = false;
        this.sid          = config.sid || null;
    },

    isSid: function(sid)
    {
        if (!_.isUndefined(sid)) {
            this.sid = sid;
        }
        
        return this.sid;        
    },
    
    isOp: function(opList)
    {
        if (!_.isUndefined(opList)) {
            // Regardless, try to determine their OP status
            this.op = _.has(opList, this.name);
        }

        return this.op;
    },

    isBanned: function(bannedList)
    {
        this.banned = !this.op && _.has(bannedList, this.name);
        return this.banned;        
    },

    isIdle: function(idle)
    {
        if (!_.isUndefined(idle)) {
            this.idle = idle;
        }
        
        return this.idle;
    },
    
    isConnected: function(connected)
    {
        if (!_.isUndefined(connected)) {
            var time = new Date().getTime();

            this.connected = connected;

            if (connected) {
                this.tsConnect = time;
            } else {
                this.tsDisconnect = time;
            }
        }

        return this.connected;
    },
    
    isLastMessage: function(message)
    {
        if (!_.isUndefined(message)) {
            var time = new Date().getTime();

            this.lastMessage = message;
            this.tsMessage   = time;
        }
        
        return {
            'time':    this.tsMessage,
            'message': this.lastMessage
        };
    },

    isRoom: function(room)
    {
        if (!_.isUndefined(room)) {
            this.room = room;
        }
        
        return this.room;
    },

    getBlogList: function()
    {
        return _.keys(this.blogList);
    }
});