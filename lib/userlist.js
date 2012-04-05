var _     = require('underscore'),
    Class = require('.//src/class'),
    User  = require('./user');

var UserList = {
    // Two different ways to access users (point to same reference)
    uidList:    null,
    sidList:    null,
    bannedList: null,
    opLevel:    null,
    opList:     null,

    init: function(userList, opLevel, opList, bannedList)
    {
        this.uidList    = {};
        this.sidList    = {};
        this.bannedList = {};
        this.opLevel    = {};
        this.opList     = {};
        
        for (var uid in userList) {
            var user = new User(uid);

            if (user.name) {
                this.uidList[user.uid] = user;
            }
        }
        
        this.opLevel = opLevel;
        
        for (var oid in opList) {
            // Save operator list, default to -1 if no match
            if (_.has(opLevel, opList[oid])) {
                this.opList[oid] = opList[oid];
            }
        }
        
        this.bannedList = bannedList;
    },

    isUser: function(uid, isSid)
    {
        if (isSid) {
            return this.sidList[uid] || null;
        } else {
            return this.uidList[uid] || null;
        }
    },
    
    refreshUserSid: function(user, sid)
    {
        // If user reconnects, we have to update their socket dependencies
        if (user.sid != sid) {
            delete this.sidList[user.sid];
            this.sidList[sid] = user;
            user.isSid(sid);
        }
    },
    
    isUserOp: function(user)
    {
        return user.isOp(this.opList && _.has(this.opList, user.uid));
    },
    
    isUserBanned: function(user)
    {
        if (user.isBanned(this.bannedList && _.has(this.bannedList, user.uid))) {
            return this.bannedList[user.uid] || 'banned';
        }
        
        return false;
    },

    addUser: function(config)
    {
        var user = new User(config);
        if (user.uid) {
            this.uidList[user.uid] = user;
            this.sidList[user.sid] = user;
        } else {
            console.log('invalid user id');
        }

        return this.uidList[user.uid];
    },
    
    removeUser: function(user)
    {
        delete this.uidList[user.uid];
        delete this.sidList[user.sid];
        delete user;
    },

    getList: function()
    {
        return _.keys(this.uidList);
    }
};

module.exports = Class.extend(UserList);