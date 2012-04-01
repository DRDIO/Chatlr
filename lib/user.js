var _     = require('underscore'),
    Class = require('./class');

module.exports = Class.extend({
    uid:            null,
    name:           null,
    title:          null,
    url:            null,
    avatar:         null,

    op:             false,
    banned:         false

    connected:      true,
    lastMessage:    null,
    tsMessage:      null,
    tsConnect:      null,
    tsDisconnect:   null,
    idle:           false,

    roomName:       null,
    blogList:       null

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
        this.tsDisconnect = time;
        this.idle         = false;
    },

    isOp: function(opList)
    {
        // Regardless, try to determine their OP status
        this.op = _.has(opList, this.name);

        return this.op;
    }

    isBanned: function(bannedList)
    {
        if (!this.op && _.has(bannedList, this.name)) {
            this.banned = true;
            this.setRoom(bannedList[this.name] || 'banned');

        } else {
            this.banned = false;
        }

        return this.banned;
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
    }

    setRoom: function(roomName)
    {
        this.roomName = roomName;

        return this.roomName;
    },

    getBlogList: function()
    {
        return _.keys(this.blogList);
    }
});
