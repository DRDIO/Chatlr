var _     = require('underscore'),
    Class = require('./src/class');

var User = {    
    uid:            null,
    sid:            null,
    name:           null,
    title:          null,
    url:            null,
    avatar:         null,

    op:             0,
    banned:         false,

    connected:      true,
    lastMessage:    '',
    tsMessage:      null,
    tsConnect:      null,
    tsDisconnect:   null,
    idle:           false,

    room:           null,
    blogList:       null,
    
    settings: {
        compact: false,
        night:   false,
        invite:  false
           
    },

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
        this.tsMessage    = time;
        this.tsConnect    = time;
        this.idle         = false;
        this.sid          = config.sid || null;
    },

    getSimple: function()
    {
        return {
            uid:    this.uid,
            name:   this.name,
            title:  this.title,
            url:    this.url,
            avatar: this.avatar,
            idle:   this.connected && this.idle
        }
    },
    
    isUid: function(uid)
    {
        if (!_.isUndefined(uid)) {
            this.uid = uid;
        }
        
        return this.uid;        
    },

    isSid: function(sid)
    {
        if (!_.isUndefined(sid)) {
            this.sid = sid;
        }
        
        return this.sid;        
    },
    
    isOp: function(op)
    {
        if (!_.isUndefined(op)) {
            this.op = op;
        }
        
        return this.op;
    },

    isBanned: function(banned)
    {
        if (!_.isUndefined(banned)) {
            this.banned = banned;
        }
        
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
        var list = [];
        
        for (var i in this.blogList) {
            list.push(this.blogList[i].name);
        }
        
        return list;
    }
};


module.exports = Class.extend(User);