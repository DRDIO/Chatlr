// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// LOAD EVENT
//
$(function() {  
    // Initialize variables
    var socket,
        clientId,
        attempts      = 0,
        users         = {},
        ignore        = {},
        userCount     = 0,
        lastTimestamp = 0,
        lastMessage   = '',
        topic         = '',
        userBlogs     = '',
        isMobile      = false,
        connected     = false,
        approved      = false,
        elScrollers   = $('.scrollbox'),
        elCurrentRoom = $('#currentroom'),
        elRooms       = $('#rooms'),
        elChat        = $('#chat'),
        elText        = $('#text');

    var DomEvent = {
        popupRoomCreate: function(e) 
        {
            e.preventDefault();

            // Get room and format it to be a url
            var newRoom = $('#roomadd input').val();
            newRoom = Room.getUrlName(newRoom);

            // Clear window and remove focus
            $('#roomadd input').val('');
            $('#text').focus();
            
            if(socket.socket.connected && newRoom != (roomUrlGet() || 'english')) {
                callServer('change', [ newRoom ]);
            }
        },
        
        popupHelp: function(e)
        {
            e.preventDefault();

            var message = 'This feature will be available in the next version!';
            if ($(this).attr('rel')) {
                message = $('#' + $(this).attr('rel')).html();
            }

            $('<div/>')
                .attr('title', $(this).attr('title'))
                .attr('id', 'dialog')
                .html(message)
                .dialog({
                    width: Math.min(640, $(window).width() * 0.8),
                    height: Math.min(400, $(window).height() * 0.8),
                    resizable: false,
                    close: function() {
                        $(this).remove()}})                
                .parent().position({my: 'center', at: 'center', of: document});
        },
        
        popupUserInfo: function(e)
        {
            // Prevent it from visiting users site
            // Prevent it from closing itself on catchall
            e.preventDefault();
            e.stopPropagation();

            var popup    = $('#user-popup'),
                user     = $(this),
                userLink = user.children('a'),
                imageSrc = user.children('img').attr('src');

            if (!popup.length) {
                popup = $('<div/>', {
                    'id':    'user-popup',
                    'click': function(e) {
                        e.stopPropagation();
                    }
                });

                $('body').append(popup);
            } else if (popup.is(':visible') && popup.data('uid') == user.attr('id')) {
                // If we are clicking the users name again, toggle popup off
                popup.hide();
                return;
            }

            imageSrc = imageSrc.substr(0, imageSrc.length - 2) + 64;

            popup
                .data('uid', user.attr('id'))
                .empty()
                .append($('<img />', {src: imageSrc}))
                .append($('<a />', {
                    href:  userLink.attr('href'),
                    title: userLink.attr('title'),
                    html:  userLink.attr('title')}
                ))
                .append($('<span />'))
                .show()
                .position({my: 'left center', at: 'left center', of: user, offset: '48 0'});
        },
        
        scrollMobile: function(e) 
        {
            var touch  = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            var y      = touch.clientY || touch.screenY || touch.pageY;
            var height = $(window).height();
            var chat   = $('#chatbox')[0].scrollHeight;

            $('#chatbox').scrollTop(chat * y / height);
            e.preventDefault();
        },
        
        hidePopup: function()
        {
            $('#user-popup').hide(); 
        },
        
        resizeWindow: function()
        {
            var width      = $(window).width(),
            height     = $(window).height(),
            leftOffset = $('#section-top-left').outerWidth(),
            chatOffset = $('#advertisement').is(':visible') ? 120 : 0,
            chatHeight = Math.round((height - 66) * 2 / 3 - 18);

            $('#text').outerWidth(width - 12);
            $('#chatbox').outerWidth(width - leftOffset - chatOffset - 18);
            $('#chatbox, #advertisement').outerHeight(height - 78);
            $('#usersbox').outerHeight(chatHeight);
            $('#roomsbox').outerHeight(height - chatHeight - 84);

            $('.scrollbox').chatlr('scroll');
            
            $('#logout').position({my: 'left top', at: 'left bottom', of: '#button-logout', offset: '0 6'});
        },
        
        submitText: function(e)
        {
            e.preventDefault();
        
            // Get the current time and message from #text
            var message   = elText.val();

            if (message.indexOf('/') == 0) {
                var divider = message.indexOf(' '),
                    length  = message.length;

                if (length != 1 && divider != 1) {
                    divider = divider == -1 ? message.length : divider;

                    var command = message.substring(1, divider),
                        content = message.substring(divider + 1);

                    console.log(command, content);

                    if (command in commandList) {
                        if (commandList[command](content)) {
                            elText.val('');
                            return true;
                        }
                    }
                }
            }

            if (commandList.message(message)) {
                elText.val('');
                return true;
            }
        },
        
        linkExternal: function(e)
        {
            e.preventDefault();
            
            var url = $(this).attr('href');
            
            $('<div/>')
                .attr('title', 'Visit External Link?')
                .html('The following link may be offensive or harmful? Do you want to visit?<br /><span class="ui-icon ui-icon-link left"></span><a>' + url + '</a>')
                .dialog({
                    buttons: {
                        'No': function() {
                            $(this).dialog('close');
                        },
                        'Yes': function() {
                            window.open(url);
                            $(this).dialog('close');
                        }
                    },
                    width: Math.min(640, $(window).width() * 0.8),
                    maxHeight: Math.min(180, $(window).height() * 0.8),
                    resizable: false})
                .parent().position({my: 'center', at: 'center', of: document});
        },
        
        logout: function(e)
        {
            e.preventDefault();            
            commandList.logout();
        },
        
        changeRooms: function(e)
        {
           e.preventDefault();
           var newRoom = $(this).attr('href');
           
           if(newRoom != (Room.getUrl() || 'english')) {
               callServer('change', [ newRoom ]);
           }
        },
        
        keydownText: function(e)
        {
            var self = $(this),
                key  = e.which;
                
            if (key == 16) {
                console.log('shifted');
                self.data('shift', true);
            } else {
                self.data('prev', key);
            }
            
            if (key == 50 && self.data('shift')) {
                console.log('amped');
                self.data('amp', true);
            }
            
            if(self.data('amp') && ((key >= 48 && key <= 57) || (key >= 65 && key <= 90) || key == 189)) {
                console.log(e.key);
            }
        },
        
        keyupText: function(e)
        {            
            var self = $(this),
                key  = e.which;
                
            if (key == 16) {
                self.data('shift', false);
            }
        }
    };
    
    var User = {
        isValidName: function(name)
        {
            
        }
    };
    
    var Room = {
        isValidName: function(name)
        {
            return (name.search(/^!?[a-z0-9-]{2,16}$/i) == 0);
        },
        
        getFancyName: function(roomName)
        {
            roomName = roomName.replace(/[!_]+/ig, '');

            var parts = roomName.split('-');
            for (var i in parts) {
                parts[i] = parts[i].substr(0, 1).toUpperCase() + parts[i].substr(1);
            }

            return parts.join(' ');
        },
        
        getUrlName: function(fancyName)
        {
            var name  = $.trim(fancyName.toLowerCase());
            var first = name.substr(0, 1).replace(/[^a-z0-9!]/, '');
            var rest  = name.substr(1, 15).replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

            return first + rest;
        },
        

        changeUrl: function(path)
        {
            if (typeof(window.history.pushState) == 'function') {
                window.history.pushState(null, path, '/' + path);
            } else {
                window.location.hash = '#!' + path;
            }

            return path;
        },

        getUrl: function ()
        {
            var url       = window.location.href;
            var firstHash = url.indexOf('#');

            firstHash = (firstHash == -1 ? url.length : firstHash);
            url       = url.substring(0, firstHash);

            var lastSlash = url.lastIndexOf('/');
            var room      = url.substr(lastSlash + 1);

            var hash     = window.location.hash;
            var mark     = hash.indexOf('#!');
            var hashRoom = (mark == -1 ? '' : hash.substr(mark + 2));

            if (typeof(window.history.pushState) == 'function') {
                return hashRoom ? Room.changeUrl(hashRoom) : room;
            } else if (room) {
                window.location = '/#!' + room;
            } else {
                return hashRoom;
            }
        }
    };
    
    var commandList = {
        away: function()
        {
            callServer('away', []);
            return true;
        },
        
        banlist: function() {
            if (isUserOp()) {
                callServer('banlist', []);
                
                return true;
            }
            
            return false;
        },
        
        ban: function(message) {
            if (isUserOp()) {
                var list = message.split(' ', 3);
                
                if (isUserName(list[0])) {
                    callServer('ban', list);
                    
                    return true;
                }
            }
            
            return false;
        },
        
        kick: function(message) {
            if (isUserOp()) {
                var list = message.split(' ', 2);
                
                if (isUserName(list[0])) {
                    callServer('kick', list);
                    
                    return true;
                }
            }
            
            return false;
        },
        
        deban: function(debanUserName)
        {
            if (isUserOp() && isUserName(debanUserName)) {
                callServer('deban', [ debanUserName ]);
                
                return true;
            }
            
            return false;
        },
        
        layout: function(type) {            
            var width      = $(window).width(),
                chatOffset = $('#advertisement').is(':visible') ? 120 : 0;

            if (!isMobile && (type == 'mobile' || type == 'compact')) {
                isMobile = true;

                $('.toplink, #button-help, #notice, #button-follow').fadeOut(250);

                $('#usersbox, #roomsbox, #advertisement').animate({opacity: 0}, 250);
                $('#section-top-left').animate({width: '0px'}, 250);                    
                $('#chatbox').animate({width: (width - 12) + 'px'}, 250);

            } else if (isMobile && (type == 'desktop' || type == 'default')) {
                isMobile = false;

                $('.toplink, #button-help, #notice, #button-follow').fadeIn(250);

                $('#usersbox, #roomsbox, #advertisement').animate({opacity: 1}, 250);
                $('#section-top-left').animate({width: '12em'}, 250);
                $('#chatbox').animate({width: (width - 144 - chatOffset - 18) + 'px'}, 250);
            }

            setTimeout(function() {
                $('.scrollbox').chatlr('scroll');
            }, 250);
            
            return true;
        },
        
        mobile: function()
        {
            commandList.layout(isMobile ? 'default' : 'compact');
        },
        
        room: function(page) {
            if (Room.isValidName(page)) {
                var newRoomName = page.toLowerCase();
                
                callServer('change', [ newRoomName ]);
                
                return true;
            }
            
            return false;
        },
        
        theme: function(type) {
            if (type == 'light' || type == 'day') {
                $('html').removeClass('night');
            } else if (type == 'dark' || type == 'night') {
                $('html').removeClass('night');
            }            
            
            return true;
        },
        
        night: function() {
            commandList.theme($('html').hasClass('night') ? 'light' : 'dark');
        },
        
        topic: function(topic) {
            if (isUserOp() && topic) {
                callServer('topic', [ topic ]);
                
                return true;
            } else {
                onMessages.message({
                    type:    'status',
                    message: 'The topic is \'' + (topic ? topic : 'Not Set') + '\'...'
                });
            }
        },
        
        help: function() {
            $('#button-help').click();
            
            return true;
        },
        
        ignore: function(ignoreUserName) {        
            if (ignoreUserName.search(/^[a-z0-9-]+$/i) == 0) {
                
                if (ignoreUserName in ignore) {
                    delete ignore[ignoreUserName];

                    for (var i in users) {
                        if (ignoreUserName == users[i].name) {
                            $('#u' + i).removeClass('ignore');
                        }
                    }
                } else {
                    // Add person to ignore list
                    ignore[ignoreUserName] = '';

                    for (var i in users) {
                        if (ignoreUserName == users[i].name) {
                            $('#u' + i).addClass('ignore');
                        }
                    }
                }
                
                return true;
            }
            
            return false;
        },
        
        shout: function(message) {
            if (isUserOp()) {
                callServer('shout', [ message ]);
                
                return true;
            }
            
            return false;
        },
        
        feature: function(featureName) {
            if (isUserOp() && Room.isValidName(featureName)) {
                callServer('feature', [ featureName ]);
                
                return true;
            }
            
            return false;
        },
        
        defeature: function(defeatureName) {
            if (isUserOp() && Room.isValidName(defeatureName)) {
                callServer('defeature', [ defeatureName ]);
                
                return true;
            }
            
            return false;
        },
        
        op: function(opUid) {
            if (isUserOp() && isUserName(opUid)) {
                callServer('op', [ opUid ]);
                
                return true;
            }
            
            return false;
        },
        
        deop: function(deopUid) {
            if (isUserOp() && isUserName(deopUid)) {
                callServer('deop', [ deopUid ]);
                
                return true;
            }
            
            return false;
        },
        
        message: function(message) {
            var timestamp = new Date().getTime();
            
            if (!isUserOp() && (message == lastMessage || timestamp - lastTimestamp < 2000 || message.length > 350)) {
                // Quickly display message to self in pink
                onMessages.message({
                    type:    'status',
                    user:    users[clientId],
                    message: 'Ignored as spam due to repetition, length, or frequency.'});

            } else if (!isUserOp() && message.search(/follow/i) != -1 && Room.getUrl() != 'follow-back') {
                // If user asks for followers, kick them to the 'follow-back' room                
                callServer('change', [ 'follow-back' ]);
                $('#text').val('');

            } else {
                lastMessage   = message;
                lastTimestamp = timestamp;

                // Send to server for broadcast
                callServer('message', [ message ]);

                // Clear text box
                $('#text').val('');
            }
        },
        
        logout: function()
        {
            callServer('logout', []);
        }
    };
    
    var onMessages = {
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // RESTART: Prompt a confirm box and help user restart session with a blank session ID
        //
        restart: function(response) {
            // Add detailed messages on errors
            // eraseCookie('connect.sid');
            notifyFailure(false);
            
            var message = response.message || 'There was an unknown error (E0)';
            if (confirm(message + '\nWould you like to restart Chatlr?')) {
                location.href = '/clear';
            }
        },
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // LOGOUT: User has requested a logout, force a clear back to the oauth
        //
        logout: function(response) {
            // Add detailed messages on errors
            // eraseCookie('connect.sid');
            location.href = '/clear';
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOMCHANGE: add, or change a room listed on the side
        //
        roomchange: function(response) {
            if ('roomName' in response && 'roomCount' in response) {
                // hotfix on room name (since ! freaks stuff out)
                response.roomName = response.roomName.replace('!', '_');
                
                var roomObj = elRooms.children('#r' + response.roomName);

                if (roomObj.length) {
                    // Update a room count
                    roomObj.children('sup').text(response.roomCount);
                } else {
                    // Create a new room
                    var roomLabel = Room.getFancyName(response.roomName);

                    roomObj = $('<div/>')
                        .attr('id', 'r' + response.roomName)                     
                        .append($('<span/>', {'class': 'ui-icon ' + (response.roomFeatured ? 'ui-icon-star' : (response.roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet'))}))
                        .append($('<a/>')
                            .attr('href', response.roomName)
                            .text(roomLabel))
                        .append($('<sup/>').text(response.roomCount));

                    elRooms.append(roomObj);
                }

                // Sort rooms by featured then user count
                elRooms.children('div').chatlr('sortusers', function(a, b) {
                    var af     = $(a).is('.featured'),
                        bf     = $(b).is('.featured'),
                        ac     = parseInt($(a).find('sup').text()),
                        bc     = parseInt($(b).find('sup').text()),
                        at     = $(a).find('a').text(),
                        bt     = $(b).find('a').text(),
                        cc     = ac > bc || (ac == bc && at < bt),
                        result = (af && (!bf || cc)) || (!af && !bf && cc);
                    
                    return (result ? -1 : 1);
                });
                
                elScrollers.chatlr('scroll');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOMDELETE: Delete a room listed on the side
        //
        roomdelete: function(response) {
            if ('roomName' in response) {
                elRooms.children('#r' + response.roomName).remove();
                elScrollers.chatlr('scroll');            
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // SETTOPIC: Update topic for user
        //
        settopic: function(response) {
            if (response.topic) {
                topic = response.topic;
                onMessages.message({
                    type:    'status',
                    message: 'The new topic is \'' + response.topic + '\''
                });
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // APPROVED: User has been approved, so create their account
        //
        approved: function(response) {
            if ('id' in response && 'roomName' in response && 'topic' in response && 'buffer' in response && 'roomUserList' in response && 'roomList' in response) {
                // On init, a list of users is grabbed (and add yourself)
                clientId     = response.id;
                users        = response.roomUserList;
                topic        = response.topic;
                userBlogs    = response.userBlogList;
                userCount    = 0;

                // Clear out sidebar and repopulate with users, updating userCount
                clearUsers();    
                for (var i in response.userList) {
                    displayUser()
                }
                for (var i in users) {
                    displayUser(users[i].name);
                    userCount++;
                }

                // Clear out sidebar rooms and populate with room list
                elRooms.empty();
                
                for (var j in response.roomList) {
                    onMessages.roomchange({
                        roomName: j,
                        roomCount: response.roomList[j].roomCount,
                        roomFeatured: response.roomList[j].roomFeatured,
                        roomHidden: response.roomList[j].roomHidden
                    });
                }

                // Update room hash
                Room.changeUrl(response.roomName == 'english' ? '' : response.roomName);

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                // Do style updates (not on reconnects)
                //
                if (!connected || approved) {
                    var fancyRoom = Room.getFancyName(response.roomName);

                    elChat.children('div.op').removeClass('title-primary');
                    
                    elChat
                        .append($('<div />')
                            .addClass('op')
                            .addClass('title-primary')

                            .append($('<span/>', {'class': 'ui-icon ' + (response.roomList[response.roomName].roomFeatured ? 'ui-icon-star' : (response.roomList[response.roomName].roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet'))}))
                            .append($('<strong/>')
                                .text(fancyRoom + ' Room')
                            )
                        )
                            
                        .append($('<div />')
                            .addClass('bottom'));

                    if (topic) {
                        // Update status to say they joined                    
                        onMessages.message({
                            type:    'status',
                            message: 'The topic is \'' + topic + '\''
                        });
                    }

                    // Output buffer messages
                    for (var j in response.buffer) {
                        onMessages.message(response.buffer[j]);
                    }
                }

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                document.title = '(' + userCount + ') Chatlr | ' + fancyRoom

                // Sort rooms by featured then user count
                elRooms.children('div').chatlr('sortusers', function(a, b) {
                    var af     = $(a).is('.featured'),
                        bf     = $(b).is('.featured'),
                        ac     = parseInt($(a).find('sup').text()),
                        bc     = parseInt($(b).find('sup').text()),
                        at     = $(a).find('a').text(),
                        bt     = $(b).find('a').text(),
                        cc     = ac > bc || (ac == bc && at < bt),
                        result = (af && (!bf || cc)) || (!af && !bf && cc);
                        
                    return (result ? -1 : 1);
                });

                // Clear all from being red, then make current room red and move to top
                elRooms.children('div').removeClass('op');
                elRooms.children('#r' + response.roomName).addClass('op').prependTo('#rooms');

                elCurrentRoom.children('.ui-icon').attr('class', 'ui-icon ' + (response.roomList[response.roomName].roomFeatured ? 'ui-icon-star' : (response.roomList[response.roomName].roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet')));
                elCurrentRoom.children('.text').html(Room.getFancyName(response.roomName) + ' Room');
                
                // Remove possible dialog box with error warnings
                // Show the chat if not already shown and clear any possible timeouts
                $('#loading:visible').fadeOut(250);
                $('#error:visible').remove();
                $('#loading-pulse').chatlr('stopstrobe');
                $('#dialog').remove();

                // Attach user blogs to the settings list
                $('#bloglist').empty();
                $.each(userBlogs, function(index, blog) {
                    if (blog.name != clientId) {
                        $('#bloglist').append($('<a>', {
                            'id':   blog.name
                        }).append($('<img>', {
                            'src': 'http://api.tumblr.com/v2/blog/' + blog.name + '.tumblr.com/avatar/16'
                        })).append($('<span>').text(blog.title)));
                    }
                });
                
                connected = true;
                approved  = true;
                
                $('.scrollbox').chatlr('scroll');
            
            } else {
                console.log('incomplete response');
                console.log(response);
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // CONNECTED: Set user into sidebar and update count
        //
        connected: function(response) {
            if (response.user) {
                // Update user counts on sidebar and in header
                userCount++;
                document.title = '(' + userCount + ') Chatlr';                
                
                // Display user on side and add
                users[response.user.name] = response.user;
                displayUser(response.user.name);                
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // DISCONNECTED: Remove user from sidebar and update count
        //
        disconnected: function(response) {
            console.log('triggered disconnected');
            
            if (response.id && response.id in users) {
                response.type = 'status';
                onMessages.message(response);
                
                // Remove user from side and delete
                $('#users #u' + response.id).remove();
                delete users[response.id];

                // Update user counts on sidebar and in header
                userCount--;
                document.title = '(' + userCount + ') Chatlr';
                
                $('.scrollbox').chatlr('scroll');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // KICKED: Remove user from sidebar and update count
        //
        kicked: function(response) {
            onMessages.disconnected(response);
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // RECONNECTED: Set a user in sidebar as returned
        //
        reconnected: function(response) {
            if (response.id) {
                $('#u' + response.id).removeClass('idle');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // AWAY: Set a user in sidebar as idle
        //
        away: function(response) {
            if (response.id) {
                $('#u' + response.id).addClass('idle');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // MESSAGE: User has sent a generic message
        //
        message: function(response) {
            if (response.message) {
                if (response.id && response.id in users) {
                    if (users[response.id].name in ignore) {
                        return;
                    }

                    // User sent a message, so not idle, and update response to pass to message
                    response.user = users[response.id];
                    $('#u' + response.id).removeClass('idle');
                }

                // Display message
                if (typeof response == 'object') {
                    // Everything is pulled from the user list

                    var row     = $('<div/>'),
                        message = $('<span/>');

                    // Some status messages are from the server (no user)
                    if ('user' in response) {
                        var title = $('<div/>')
                                .text('Visit ' + clean(response.user.title)),
                            link = $('<a/>')
                                .attr('href', clean(response.user.url))
                                .attr('target', '_blank')
                                .attr('title', clean(title.html()))
                                .text(clean(response.user.name));

                        row.append($('<img/>').attr('src', clean(response.user.avatar)));

                        if ('op' in response.user && response.user.op) {
                            link.addClass('op');
                        }
                    }

                    // Clean message then update usernames to tumblr links
                    response.message = strip(response.message);
                    response.message = response.message.replace(/(https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_.-]*(\?\S+)?(#\S+)?)?)?)/g, '<a href="$1" class="external" title="Visit External Link!" target="_blank"><strong>[link]</strong></a>');
                    response.message = response.message.replace(/(^| )@([a-z0-9-]+)($|[' !?.,:;])/gi, '$1<a href="http://$2.tumblr.com/" title="Visit Their Tumblr!" target="_blank"><strong>@$2</strong></a>$3');
                    response.message = response.message.replace(/(#(!?[a-z0-9-]{2,16}))/gi, '<a href="$2" class="room" title="Go to $2 Room">$1</a>');

                    // MESSAGE: The default message from a user
                    if (response.type == 'message') {
                        message.html(': ' + response.message);
                        if (clientId in users) {
                            if ('user' in response && response.user.name == users[clientId].name) {
                                row.addClass('personal');
                            } else {
                                // Try to save having to do a rege exp all the time
                                var selfMatch = new RegExp('@' + users[clientId].name, 'gi');
                                if (response.message.search(selfMatch) != -1) {
                                    row.addClass('personal');
                                }
                            }
                        }

                    // STATUS: Status messages just show a faded message
                    } else if (response.type == 'status') {
                        row.addClass('status');
                        message.html(' ' + response.message);
                    }

                    // insert message
                    $('#chat div:last').before(row.append(link).append(message));
                }

                // Scroll to the end of the page unless someone is hovering
                if ($('body').data('hoverbox') != 'chatbox') {
                    $('#chatbox').chatlr('scroll', $('#chat').outerHeight(true) - 6);
                } else {
                    // $('#chatbox').chatlr('scroll');
                }
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // STATUS: A grayed out message sent to everyone, does not require an ID
        //
        status: function(response) {
            onMessages.message(response);
        }
    }
        
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Connect to socket server
    if (typeof io == 'undefined') {
        notifyFailure(false);
    } else {
        socket = new io.connect(null, {
            'transports': ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
            'connect timeout': 5000,
            'try multiple transports': true,
            'reconnect': true,
            'reconnection delay': 250,
            'max reconnection attempts': 3            
        });
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // CONNECT: As soon as we connect, send credentials. Chat is still disabled at this time.
        //
        socket.on('connect', function()
        {
            console.log('connection established with ' + this.transport);
        });
        
        socket.on('connecting', function(type)
        {
            console.log('connecting with ' + type);
        });
        
        socket.on('connect_failed', function()
        {
            console.log('connect failed');
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // DISCONNECT: Attempt to reconnect immediately
        //
        socket.on('disconnect', function()
        {
            console.log('disconnected');
            notifyFailure(false);
        });
        
        socket.on('reconnect', function(type, attempts)
        {
            console.log('reconnected with ' + type + ' for ' + attempts);
        });
        
        socket.on('reconnecting', function(delay, attempts)
        {
            console.log('reconnecting with ' + delay + ' for ' + attempts);
        });
        
        socket.on('reconnect_failed', function()
        {
            console.log('reconnect failed');
        });
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // MESSAGE: Process a response from the server based on onMessages methods
        //
        socket.on('message', function(response)
        {
            if (response.type && response.type in onMessages) {
                // if (typeof console !== 'undefined') console.log(response.type);
                onMessages[response.type](response);
            }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // SUBMIT EVENT: When the text box is submitted, prevent submission and send message
        //
        
        $('#text').on('keydown', DomEvent.keydownText);
        $('#text').on('keyup', DomEvent.keyupText);
        
        $('#text').keydown(function(e) {
            var self = $(this),
                key  = e.which;
                
            if (key == 16) {
                console.log('shifted');
                self.data('shift', true);
            } else {
                self.data('prev', key);
            }
            
            if (key == 50 && self.data('shift')) {
                console.log('amped');
                self.data('amp', true);
            }
            
            if(self.data('amp') && ((key >= 48 && key <= 57) || (key >= 65 && key <= 90) || key == 189)) {
                console.log(e.key);
            }
        });
        
        $('#text').keyup(function(e) {
            var self = $(this),
                key  = e.which;
                
            if (key == 16) {
                self.data('shift', false);
            }
        })
    }
    
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    function callServer(method, params) {
        var pkg = {};
        pkg[method] = params;
        
        socket.json.send(pkg); 
    };
     
    function clearUsers()
    {
        $('#users').html('');
        $('.scrollbox').chatlr('scroll');
    }

    function displayUser(id)
    {
        if (id in users) {
            var user;
            if ($('#users #u' + id).length) {
                // If we are updating user, clear their contents but keep order
                user = $('#users #u' + id).empty();
            } else {
                // Otherwise create element
                user = $('<div/>').attr('id', 'u' + id);
            }
            
            user
                .append($('<img/>')
                    .attr('src', clean(users[id].avatar)))
                .append($('<a/>')
                    .attr('href', clean(users[id].url))
                    .attr('target', '_blank')
                    .attr('title', clean('Visit ' + users[id].title))
                    .text(clean(users[id].name)));
            
            if (users[id].name in ignore) {
                user.addClass('ignore');
            }

            if (clientId && id == clientId) {
                user.addClass('personal');
                $('#users').prepend(user);
            } else {
                $('#users').append(user);
            }

            if (users[id].op) {
                user.addClass('op');
            }

            if (users[id].idle) {
                user.addClass('idle');
            }
            
            $('.scrollbox').chatlr('scroll');            
        }
    }

    function isUserOp()
    {
        return (clientId in users && 'op' in users[clientId] && users[clientId].op);
    }
    
    function isUserName(name)
    {
        return (name.search(/^[a-z0-9-]+$/i) == 0);
    }
    
    function toggleUserOptions(e) {

    }

    function clean(message)
    {
        return (message ? $('<div/>').text(message).text() : '');
    }

    function strip(message)
    {
        return $('<div/>').text(message).html();
    }    

    function notifyFailure(hasSocket)
    {
        if (!hasSocket || (!socket.socket.connecting && !socket.socket.connected)) {
            // Stop logo pulsing and make sure the background is faded in
            $('#loading-pulse').chatlr('stopstrobe');
            $('#loading').show();

            $('<div/>')
                .attr('title', 'Oh Nos, Chatlr Died!')
                .attr('id', 'dialog')
                .html($('#page-about').html())
                .css({top: 0, left: 0})
                .dialog({
                    width: Math.min(640, $(window).width() * 0.8),
                    height: Math.min(400, $(window).height() * 0.8),
                    resizable: false,
                    close: function() {
                        $(this).remove()}})
                .parent().position({my: 'center', at: 'center', of: document});
        }
    }

    var Init = {
        buttons: function()
        {
            // Setup Button Icons
            $('#button-logout').button({text: false, icons: {primary: 'ui-icon-power'}});
            $('#button-settings').button({text: false, icons: {primary: 'ui-icon-wrench'}});
            $('#button-changeroom').button({text: false, icons: {primary: 'ui-icon-comment'}});    
            $('#button-help').button({text: false, icons: {primary: 'ui-icon-help'}});
            $('#button-follow').button({text: false, icons: {primary: 'ui-icon-plus'}});
        },
        
        events: function()
        {
            // CLICK EVENT: When buttons are clicked, show a popup
            $('#button-help').on('click', DomEvent.popupHelp);

            // CLICK EVENT: Logout
            $('#button-logout').on('click', DomEvent.logout);

            // SUBMIT EVENT: Trigger text submission
            $('#form').on('submit', DomEvent.submitText);

            $(document)
                // LIVE EVENT: User has clicked an external link, show prompt dialog
                .on('click', '.external', DomEvent.linkExternal)

                // LIVE EVENT: User has clicked a link for rooms, switch rooms
                .on('click', '#rooms a, .room', DomEvent.changeRooms)

                // LIVE EVENT: Show user dialog with extra features
                .on('click', '#users>div', DomEvent.popupUserInfo);

            // RESIZE EVENT: Setup window sizing for any resize (and load)
            $(window).on('resize', DomEvent.windowResize).trigger('resize');

            // CLICK EVENT: Dialog box to create a room for user
            $('#button-room').on('click', '#button-room', DomEvent.createRoom)

            $('body')
                // TOUCH EVENT: Mobile scrolling event
                .on('touchstart touchmove', DomEvent.touchScroll)

                // CLICK EVENT: Hide any popup using the bubbling trick
                .on('click', 'body', DomEvent.hidePopup);
        },
        
        dom: function()
        {
            // MOBILE: Hide headers on iPhone  
            window.top.scrollTo(0, 1);

            // Setup initial title
            document.title = 'Chatlr (Connecting...)'
            $('#loading-pulse').chatlr('strobe'); 
            
            $('#logout').hide();        
        }
    };
    
    function init() {
        // Call all of the init methods
        for (var i in Init) {
            Init[i]();
        }
    }
    
    init();
});

       
        