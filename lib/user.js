var Class = require('./class');

module.exports = Class.extend({
    uid:            null,
    name:           null,
    title:          null,
    url:            null,
    avatar:         null,

    lastMessage:    null,
    tsMessage:      null,
    tsDisconnect:   null,
    idle:           false,

    init: function(config)
    {
        // UID is usually their name but we need to start using UID for all mapping
        user.uid    = userSession.uid;
        user.name   = userSession.name   || user.uid;
        user.title  = userSession.title  || user.name;
        user.url    = userSession.url    || null;
        user.avatar = userSession.avatar || null;

        // Otherwise initialize additional vars
        user.lastMessage  = '';
        user.tsMessage    = time;
        user.tsDisconnect = time;
        user.idle         = false;

        this.config = config;
    }
});