var _     = require('underscore'),
    Class = require('./src/class'),
    Room  = require('./room');

var RoomList = {
    list: null,

    init: function(list)
    {
        this.list = {};

        for (var name in list) {
            var room = new Room(name, true);

            if (room.name) {
                this.list[room.name] = room;
            }
        }
    },

    isRoom: function(name, isCreate)
    {    
        if (!_.isUndefined(name) && isCreate && !_.has(this.list, name)) {
            var room = new Room(name);

            if (room.name) {
                this.list[room.name] = room;
            }            
        }
        
        return this.list[name] || null;
    },
    
    removeRoom: function(room)
    {
        delete this.list[room.name];
        delete room;
    },

    getList: function(isClient, isVisible, includeRoom)
    {
        // Supply a smaller package for the client
        if (isClient) {
            var list = {};
            for (var i in this.list) {
                // If we don't require visibility, or it isn't hidden or the user is a part of the room, send
                if (!isVisible || !this.list[i].isHidden() || i == includeRoom.name) {
                    list[i] = {
                        roomCount:    this.list[i].getUserCount(),
                        roomFeatured: this.list[i].isFeatured(),
                        roomHidden:   this.list[i].isHidden()
                    };
                }
            }

            return list;
        } else {
            return this.list;
        }
    }
};

module.exports = Class.extend(RoomList);