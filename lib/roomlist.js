var _     = require('underscore'),
    Class = require('./class'),
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

    isRoom: function(name)
    {
        return this.list[name] || null;
    },

    getList: function()
    {
        return _.keys(this.list);
    }
});