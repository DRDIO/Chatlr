var _     = require('underscore'),
    Class = require('./src/class'),
    Room  = require('./room');

var RoomList = {
    list:    null,
    dbc:     null,
    dftName: null,

    init: function(dbc, dftName)
    {
        this.list = {};
        this.dbc  = dbc;
        
        // Setup a default name
        this.dftName = dftName || 'main';

        // Ensure db users are unique
        this.dbc.ensureIndex({name: 1}, {unique: true});
        
        // Find existing rooms stored in the database
        this.dbc.find({featured: true}).forEach(_.bind(function(err, row) {
            if (row) {
                // Setup all featured rooms (set topic as well but ignore save loop)
                var room = this.isRoom(row.name, true);
                room.isFeatured(true);
                room.isTopic(row.topic);
            }
            
        }, this));
        
        console.log('Pulling DEFAULT rooms');
    },
    
    isTopic: function(room, topic)
    {
        if (!_.isUndefined(topic)) {
            room.isTopic(topic);
            
            this.dbcSave(room);
        }
        
        return room.isTopic();
    },
    
    isFeatured: function(room, featured)
    {
        if (!_.isUndefined(featured)) {
            room.isFeatured(featured);
            
            this.dbcSave(room);
        }
        
        return room.isFeatured();
    },
    
    dbcSave: function(room)
    {
        this.dbc.update({
            name: room.name
        }, {
            name:     room.name,
            featured: room.featured,
            topic:    room.topic
        }, {
            upsert: true
        });
    },

    isRoom: function(name, isCreate)
    {   
        var room = this.list[name] || null;
        
        if (!room && isCreate) {
            room = new Room(name);

            if (room.name) {
                console.log ('Room ' + room.name + ' created.');
                this.list[room.name] = room;
                
                console.log('saving room');
                this.dbcSave(room);
                
            } else {
                // Invalid name after being processed upon creation
                console.log('unable to create ' + name);
                delete room;
            }  
        }
        
        return room;
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