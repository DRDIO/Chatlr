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

    init: function(userList, opLevel, opList)
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
    
    isUserOp: function(user, opLevel, isSync)
    {
        console.log(user + ' ' + opLevel + ' ' + isSync);
        
        if (!_.isUndefined(opLevel) && !_.isNull(opLevel)) {
            var response = user.isOp(opLevel);
            
            if (opLevel) {
                this.opList[user.uid] = user;
            } else {
                delete this.opList[user.uid];
            }
            
            return response;
            
        } else if (isSync) {
            // On initialize, we need to sync user with the current op list
            return user.isOp(_.has(this.opList, user.uid));
            
        } else {            
            return _.has(this.opList, user.uid) ? user.isOp() : false;
        }
    },
    
    isUserBanned: function(user, duration)
    {
        if (!_.isUndefined(duration)) {
            // Set user banned level
            user.isBanned(duration);
            
            if (duration) {
                this.bannedList[user.uid] = user;
            } else {
                delete this.bannedList[user.uid];
            }
        } else {
            return _.has(this.bannedList, user.uid) ? user.isBanned() : false;
        }
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
    },
    
    getBannedList: function()
    {
        return _.keys(this.bannedList);
    }
};

module.exports = Class.extend(UserList);