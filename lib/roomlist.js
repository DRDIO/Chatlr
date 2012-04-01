var _     = require('underscore'),
    Class = require('./src/class'),
    Room  = require('./room');

module.exports = Class.extend({
    list: {},

    init: function(list)
    {
        for (var name in list) {
            var room = new Room(name);

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

    getList: function(isClient)
    {
        // Supply a smaller package for the client
        if (isClient) {
            var list = {};
            for (var i in this.list) {
                list[i] = {
                    roomCount: this.list[i].userList.length,
                    roomFeatured: this.list[i].featured
                };
            }

            return list;
        } else {
            return this.list;
        }
    }
});