var _     = require('underscore'),
    Class = require('.//src/class'),
    User  = require('./user');

var UserList = {
    // Two different ways to access users (point to same reference)
    uidList:    null,
    sidList:    null,
    bannedList: null,
    opLevel:    {
        'banned':  -2,
        'locked':  -1,
        'guest':    0,
        'special':  1,
        'roommod':  2,
        'admin':    3,
        'owner':    4
    },
    opList:     null,
    dbc:        null,

    init: function(dbc, dftOwner)
    {
        this.uidList    = {};
        this.sidList    = {};
        this.bannedList = {};
        this.opList     = {};
        this.dbc        = dbc;

        // Ensure db users are unique
        this.dbc.ensureIndex({uid: 1}, {unique: true});
        
        console.log('initializing with ' + dftOwner);
        
        if (dftOwner) {
            this.opList[dftOwner] = this.opLevel.owner;
            
            this.dbcSave({
                uid: dftOwner,
                op:  this.opLevel.owner
            });                        
        }
            
        // Pull the default information from database
        this.initFromDbc();
    },
    
    initFromDbc: function()
    {
        // Find all operators and store in a local list
        this.dbc
            .find({op: {$gte: this.opLevel.roommod} })
            .forEach(_.bind(function(err, row) {
                if (row) {
                    this.opList[row.uid] = row.op;
                }
            }, this));
            
        // Find all banned users and store in a local list
        this.dbc
            .find({op: {$lte: this.opLevel.locked} })
            .forEach(_.bind(function(err, row) {
               if (row) {
                   this.bannedList[row.uid] = row.op;
               } 
            }, this));
    },

    isUser: function(uid, isSid)
    {
        if (isSid) {
            return this.sidList[uid] || null;
        } else {
            return this.uidList[uid] || null;
        }
    },
    
    dbcSave: function(user)
    {
        this.dbc.update({
            name: user.uid
        }, {
            uid: user.uid,
            op:  user.op
        }, {
            upsert: true
        });
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
    
    isUserOp: function(user, opLevel)
    {
        console.log('Op setup ' + user.uid + ' ' + opLevel);
        
        var isOp;
        
        if (!_.isUndefined(opLevel)) {
            isOp = user.isOp(opLevel);
            
            // Save changes in database
            this.dbcSave(user);
            
        } else {
            isOp = user.isOp();
        }
        
        // Sync everything with the current user list
        if (isOp) {
            this.opList[user.uid] = isOp;
        } else {
            delete this.opList[user.uid];
        }
        
        return isOp;
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
    },
    
    onConnect: function(session, callback) 
    {
        // Attempt to get existing user, if it can't be retrieved, create it                
        var user   = this.isUser(session.uid),
            userOp = user.isOp() || this.opLevel.guest;
            
        console.log(userOp);
                        
        // Check if user exists locally
        if (!user) {
            console.log('Find user in DB');
            
            // Try to find the user in the db
            this.dbc.findOne({uid: session.uid}, _.bind(function(err, dbUser) {
                user = this.addUser(session);
                
                this.isUserOp(user, userOp);
                
                if (!dbUser) {
                    console.log('DB: Creating user');
                    
                    // Save the user for future references
                    this.dbcSave(user);
                }
                
                callback(user);
            }, this));

        } else {
            // Update user to be connected
            user.isConnected(true);
            this.isUserOp(user, userOp);
            
            this.refreshUserSid(user, session.sid);
            
            callback(user);
        }
    }
};

module.exports = Class.extend(UserList);