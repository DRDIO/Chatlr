var _            = require('underscore'),
    Express      = require('express'),
    Connect      = require('connect'),
    SocketIo     = require('socket.io'),
    MongoJs      = require('mongojs'),

    OauthReq     = require('./lib/oauthreq'),
    Class        = require('./lib/class'),

    MemoryStore  = Express.session.MemoryStore;

var Sioa = {
    store:     null,
    server:    null,
    iosockets: null,
    db:        null,

    init: function(config, redirectCallback) {
        console.log('Starting SocketIOAuth');
    },

    onConnect: function(socket)
    {
        console.log('starting connection');

        // Apply a reference back to the core app to be used with onMessage
        socket.app = this;

        socket.on('message', this.onMessage);
        socket.on('disconnect', this.onDisconnect);
    },

    onDisconnect: function()
    {
        // Nothing to do right now but tear down
    },

    onMessage: function(request)
    {

    },

    messageClient: function(socket, method, request)
    {
        if (_.isObject(socket)) {
            request.type = method;
            socket.json.send(request);
        } else {
            throw 'missing socket';
            console.log('missing socket');
        }
    },

    messageAll: function(method, request)
    {
        request.type = method;
        this.iosockets.sockets.json.send(request);
    },

    getSocket: function(sid)
    {
        return this.iosockets.sockets.sockets[sid];
    },

    getSession: function(socket)
    {
        return socket.handshake.session || null;
    }
};


module.exports = Class.extend(Sioa);