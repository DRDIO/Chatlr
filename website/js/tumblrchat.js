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
        elCurrentRoom = $('#currentroom'),
        
        elBody        = $('body'),
        
        elScrollers   = elBody.find('.scrollbox'),
        elAnimators   = elBody.find('.animator'),        
        elNotMobile   = elBody.find('.toplink, #button-help, #notice, #button-follow'),
        
        elHeader      = elBody.children('#top'),
          btnLogout     = elHeader.children('#button-logout'),
          btnHelp       = elHeader.children('#button-help'),
          btnFollow     = elHeader.children('#button-follow'),

        elTop         = elBody.children('#section-top'),
          elAd          = elTop.children('#advertisement'),
          elSide        = elTop.children('#section-top-left'),
            elRoomsbox    = elSide.children('#roomsbox'),
              btnRoom       = elRoomsbox.children('#button-room'),
              elRooms       = elRoomsbox.children('#rooms'),
              
            elUsersbox    = elSide.children('#usersbox'),
              elUsers       = elUsersbox.children('#users'),
            
          elChatbox     = elTop.children('#chatbox'),
            elChat        = elChatbox.children('#chat'),
            
        elBottom      = elBody.children('#section-bottom'),
          elForm        = elBottom.children('#form'),
            elText        = elForm.children('#text'),

        popAbout      = elBody.children('#page-about'),
        popCreateRoom = elBody.children('#page-createroom'),
          elRoomForm    = popCreateRoom.children('#room-form'),
            elRoomName    = elRoomForm.find('#room-name'),
            elRoomType    = elRoomForm.find('#room-type'),
        popError      = elBody.children('#page-error'),

        elLoading     = elBody.children('#loading'),
          elPulse       = elLoading.children('#loading-pulse'),

        elLogout      = elBody.children('#logout');

    var Util = {
        sort: function(a, b)
        {
            var af     = $(a).is('.featured'),
                bf     = $(b).is('.featured'),
                ac     = parseInt($(a).find('sup').text()),
                bc     = parseInt($(b).find('sup').text()),
                at     = $(a).find('a').text(),
                bt     = $(b).find('a').text(),
                cc     = ac > bc || (ac == bc && at < bt),
                result = (af && (!bf || cc)) || (!af && !bf && cc);

            return (result ? -1 : 1);
        },
        
        clean: function(message)
        {
            return (message ? $('<div/>').text(message).text() : '');
        },
        
        strip: function(message)
        {
            return $('<div/>').text(message).html();
        },
        
        callServer: function(method, params) 
        {
            var pkg = {};
            pkg[method] = params;

            socket.json.send(pkg); 
        },
        
        notifyFailure: function(hasSocket)
        {
            if (!hasSocket || (!socket.socket.connecting && !socket.socket.connected)) {
                // Stop logo pulsing and make sure the background is faded in
                elPulse.chatlr('stopstrobe');
                elLoading.show();

                $('<div/>')
                    .attr('title', 'Oh Nos, Chatlr Died!')
                    .attr('id', 'dialog')
                    .html(popAbout.html())
                    .css({top: 0, left: 0})
                    .dialog({
                        width: Math.min(640, $(window).width() * 0.8),
                        height: Math.min(400, $(window).height() * 0.8),
                        resizable: false,
                        close: function() {
                            $(this).remove()
                        }
                    })
                    .parent().position({my: 'center', at: 'center', of: document});
            }
        }
    };
    
    var DomEvent = {
        toggleRoomType: function(e)
        {
            e.preventDefault();
            
            var self = $(this);
            
            if (self.val() == 'Public') {
                self.val('Private');
                self.button({icons: {primary: 'ui-icon-comment'}});
                self.find('.ui-button-text').text('Private');
            } else {
                self.val('Public');
                self.button({icons: {primary: 'ui-icon-bullet'}});
                self.find('.ui-button-text').text('Public');
            }
        },
        
        stopPropagation: function(e)
        {
            e.stopPropagation();
        },
        
        popupCreateRoom: function(e) 
        {
            var self = $(this);
            
            e.preventDefault();
            e.stopPropagation();
            
            elRoomName.val('');
                                        
            elRoomType
                .val('Public')
                .button({icons: {primary: 'ui-icon-bullet'}});
            
            popCreateRoom
                .show()
                .position({my: 'left center', at: 'left center', of: self, offset: '48 0'});
                
            elRoomName.focus();
        },
        
        popupHelp: function(e)
        {
            var self = $(this);
            
            e.preventDefault();
            
            var message = 'This feature will be available in the next version!';
            if (self.attr('rel')) {
                message = $('#' + self.attr('rel')).html();
            }

            $('<div/>')
                .attr('title', self.attr('title'))
                .attr('id', 'dialog')
                .html(message)
                .dialog({
                    width: Math.min(640, $(window).width() * 0.8),
                    height: Math.min(400, $(window).height() * 0.8),
                    resizable: false,
                    close: function() {
                        self.remove()
                    }
                })                
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

                elBody.append(popup);
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
            var chat   = elChatbox[0].scrollHeight;

            elChatbox.scrollTop(chat * y / height);
            e.preventDefault();
        },
        
        hidePopup: function()
        {
            $('#user-popup').hide();
            popCreateRoom.filter(':visible').hide();
        },
        
        resizeWindow: function()
        {
            var width  = $(window).width(),
            height     = $(window).height(),
            leftOffset = elSide.outerWidth(),
            chatOffset = elAd.is(':visible') ? 120 : 0,
            chatHeight = Math.round((height - 66) * 2 / 3 - 18);

            elText.outerWidth(width - 12);
            elChatbox.outerWidth(width - leftOffset - chatOffset - 18);
            
            elChatbox.outerHeight(height - 78);
            elAd.outerHeight(height - 78);
            elUsersbox.outerHeight(chatHeight);
            elRoomsbox.outerHeight(height - chatHeight - 84);

            elScrollers.chatlr('scroll');
            
            elLogout.position({my: 'left top', at: 'left bottom', of: '#button-logout', offset: '0 6'});
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

                    if (command in Command) {
                        if (Command[command](content)) {
                            elText.val('');
                            return true;
                        }
                    }
                }
            }

            if (Command.message(message)) {
                elText.val('');
                return true;
            }
        },
        
        toggleFeatured: function(e)
        {
            e.preventDefault();
            
            var self = $(this);
            
            if (self.attr('data-featured')) {
                Command.defeature(self.attr('rel'));
            } else {
                Command.feature(self.attr('rel'));
            }
            
        },
        
        linkExternal: function(e)
        {
            e.preventDefault();
            
            var self = $(this),
                url  = self.attr('href');
            
            $('<div/>')
                .attr('title', 'Visit External Link?')
                .html('The following link may be offensive or harmful? Do you want to visit?<br /><span class="ui-icon ui-icon-link left"></span><a>' + url + '</a>')
                .dialog({
                    buttons: {
                        'No': function() {
                            self.dialog('close');
                        },
                        'Yes': function() {
                            window.open(url);
                            self.dialog('close');
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
            Command.logout();
        },
        
        createRoom: function(e)
        {
            e.preventDefault();
            
            var isPrivate = (elRoomType.val() == 'Private' ? '!' : ''),
                urlName   = Room.getUrlName(elRoomName.val());
                
            if (urlName) {
                Util.callServer('change', [ isPrivate + urlName ]);
                popCreateRoom.hide();
            }
        },
        
        changeRooms: function(e)
        {
           e.preventDefault();
           var newRoom = $(this).attr('href');
           
           if(newRoom != (Room.getUrl() || 'english')) {
               Util.callServer('change', [ newRoom ]);
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
        populate: function(list)
        {        
            elUsers.empty();
            
            for (var i in list) {
                User.display(list[i].name);
                userCount++;
            }
        },
        
        isOp: function()
        {
            return (clientId in users && 'op' in users[clientId] && users[clientId].op);
        },
        
        isValidName: function(name)
        {
            return (name.search(/^[a-z0-9-]+$/i) == 0);
        },
        
        display: function(id)
        {
            if (id in users) {
                var user = elUsers.children('#users #u' + id);
                
                if (user.length) {
                    // If we are updating user, clear their contents but keep order
                    user.empty();
                } else {
                    // Otherwise create element
                    user = $('<div/>').attr('id', 'u' + id);
                }

                user
                    .append($('<img/>')
                        .attr('src', Util.clean(users[id].avatar)))
                    .append($('<a/>')
                        .attr('href', Util.clean(users[id].url))
                        .attr('target', '_blank')
                        .attr('title', Util.clean('Visit ' + users[id].title))
                        .text(Util.clean(users[id].name)));

                if (users[id].name in ignore) {
                    user.addClass('ignore');
                }

                if (clientId && id == clientId) {
                    user.addClass('personal');
                    elUsers.prepend(user);
                } else {
                    elUsers.append(user);
                }

                if (users[id].op) {
                    user.addClass('op');
                }

                if (users[id].idle) {
                    user.addClass('idle');
                }

                // Update user box since more have been added
                elUsersbox.chatlr('scroll');            
            }
        }
    };
    
    var Room = {
        populate: function(list)
        {
            elRooms.empty();
                
            for (var i in list) {
                Action.roomchange({
                    roomName: i,
                    roomCount: list[i].roomCount,
                    roomFeatured: list[i].roomFeatured,
                    roomHidden: list[i].roomHidden
                });
            }
        },
        
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
    
    var Command = {
        away: function()
        {
            Util.callServer('away', []);
            return true;
        },
        
        banlist: function() {
            if (User.isOp()) {
                Util.callServer('banlist', []);
                
                return true;
            }
            
            return false;
        },
        
        ban: function(message) {
            if (User.isOp()) {
                var list = message.split(' ', 3);
                
                if (User.isValidName(list[0])) {
                    Util.callServer('ban', list);
                    
                    return true;
                }
            }
            
            return false;
        },
        
        kick: function(message) {
            if (User.isOp()) {
                var list = message.split(' ', 2);
                
                if (User.isValidName(list[0])) {
                    Util.callServer('kick', list);
                    
                    return true;
                }
            }
            
            return false;
        },
        
        deban: function(debanUserName)
        {
            if (User.isOp() && User.isValidName(debanUserName)) {
                Util.callServer('deban', [ debanUserName ]);
                
                return true;
            }
            
            return false;
        },
        
        layout: function(type) {            
            var width      = $(window).width(),
                chatOffset = elAd.is(':visible') ? 120 : 0;

            if (!isMobile && (type == 'mobile' || type == 'compact')) {
                isMobile = true;

                elNotMobile.fadeOut(250);

                elAnimators.animate({opacity: 0}, 250);
                elSide.animate({width: '0px'}, 250);                    
                elChatbox.animate({width: (width - 12) + 'px'}, 250);

            } else if (isMobile && (type == 'desktop' || type == 'default')) {
                isMobile = false;

                elNotMobile.fadeIn(250);

                elAnimators.animate({opacity: 1}, 250);
                elSide.animate({width: '12em'}, 250);
                elChatbox.animate({width: (width - 144 - chatOffset - 18) + 'px'}, 250);
            }

            // After animations finish, update scrollbars
            setTimeout(function() {
                elScrollers.chatlr('scroll');
            }, 250);
            
            return true;
        },
        
        mobile: function()
        {
            Command.layout(isMobile ? 'default' : 'compact');
        },
        
        room: function(page) {
            if (Room.isValidName(page)) {
                var newRoomName = page.toLowerCase();
                
                Util.callServer('change', [ newRoomName ]);
                
                return true;
            }
            
            return false;
        },
        
        theme: function(type) {
            if (type == 'light' || type == 'day') {
                elBody.removeClass('night');
            } else if (type == 'dark' || type == 'night') {
                elBody.removeClass('night');
            }            
            
            return true;
        },
        
        night: function() {
            Command.theme(elBody.hasClass('night') ? 'light' : 'dark');
        },
        
        topic: function(topic) {
            if (User.isOp() && topic) {
                Util.callServer('topic', [ topic ]);
                
                return true;
            } else {
                Action.message({
                    type:    'status',
                    message: 'The topic is \'' + (topic ? topic : 'Not Set') + '\'...'
                });
                
                return true;
            }
            
            return false;
        },
        
        help: function() {
            btnHelp.trigger('click');
            
            return true;
        },
        
        ignore: function(ignoreUserName) {        
            if (ignoreUserName.search(/^[a-z0-9-]+$/i) == 0) {
                
                if (ignoreUserName in ignore) {
                    delete ignore[ignoreUserName];

                    for (var i in users) {
                        if (ignoreUserName == users[i].name) {
                            elUsers.children('#u' + i).removeClass('ignore');
                        }
                    }
                } else {
                    // Add person to ignore list
                    ignore[ignoreUserName] = '';

                    for (var i in users) {
                        if (ignoreUserName == users[i].name) {
                            elUsers.children('#u' + i).addClass('ignore');
                        }
                    }
                }
                
                return true;
            }
            
            return false;
        },
        
        shout: function(message) {
            if (User.isOp()) {
                Util.callServer('shout', [ message ]);
                
                return true;
            }
            
            return false;
        },
        
        feature: function(featureName) {
            if (User.isOp() && Room.isValidName(featureName)) {
                Util.callServer('feature', [ featureName ]);
                
                return true;
            }
            
            return false;
        },
        
        defeature: function(defeatureName) {
            if (User.isOp() && Room.isValidName(defeatureName)) {
                Util.callServer('defeature', [ defeatureName ]);
                
                return true;
            }
            
            return false;
        },
        
        op: function(opUid) {
            if (User.isOp() && User.isValidName(opUid)) {
                Util.callServer('op', [ opUid ]);
                
                return true;
            }
            
            return false;
        },
        
        deop: function(deopUid) {
            if (User.isOp() && User.isValidName(deopUid)) {
                Util.callServer('deop', [ deopUid ]);
                
                return true;
            }
            
            return false;
        },
        
        message: function(message) {
            var timestamp = new Date().getTime();
            
            if (!User.isOp() && (message == lastMessage || timestamp - lastTimestamp < 2000 || message.length > 350)) {
                // Quickly display message to self in pink
                Action.message({
                    type:    'status',
                    user:    users[clientId],
                    message: 'Ignored as spam due to repetition, length, or frequency.'});

            } else if (!User.isOp() && message.search(/follow/i) != -1 && Room.getUrl() != 'follow-back') {
                // If user asks for followers, kick them to the 'follow-back' room                
                Util.callServer('change', [ 'follow-back' ]);
                elText.val('');

            } else {
                lastMessage   = message;
                lastTimestamp = timestamp;

                // Send to server for broadcast
                Util.callServer('message', [ message ]);

                // Clear text box
                elText.val('');
            }
        },
        
        logout: function()
        {
            Util.callServer('logout', []);
        }
    };
    
    var Action = {
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // RESTART: Prompt a confirm box and help user restart session with a blank session ID
        //
        restart: function(response) {
            // Add detailed messages on errors
            // eraseCookie('connect.sid');
            Util.notifyFailure(false);
            
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
                    roomObj.children('span').attr('class', 
                        'ui-icon ' + (response.roomFeatured ? 'ui-icon-star' : (response.roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet'))
                    );
                } else {
                    // Create a new room
                    var roomLabel = Room.getFancyName(response.roomName);

                    roomObj = $('<div/>')
                        .attr('id', 'r' + response.roomName)                     
                        .append($('<span/>', {'class': 'ui-icon ' + (response.roomFeatured ? 'ui-icon-star' : (response.roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet'))}))
                        .append($('<a/>', {
                            'href': response.roomName,
                            'text': roomLabel,
                            'title': roomLabel
                        }))
                        .append($('<sup/>').text(response.roomCount));

                    elRooms.append(roomObj);
                }

                // Sort rooms by featured then user count
                elRooms.children('div').chatlr('sortusers', Util.sort);
                
                // Update room box since new ones were added
                elRoomsbox.chatlr('scroll');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // ROOMDELETE: Delete a room listed on the side
        //
        roomdelete: function(response) {
            if ('roomName' in response) {
                elRooms.children('#r' + response.roomName).remove();
                
                // Update room box since new ones were removed
                elRoomsbox.chatlr('scroll');            
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // SETTOPIC: Update topic for user
        //
        settopic: function(response) {
            if (response.topic) {
                topic = response.topic;
                Action.message({
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
                User.populate(users);                

                // Clear out sidebar rooms and populate with room list
                Room.populate(response.roomList);
                
                // Update room hash
                Room.changeUrl(response.roomName);

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                // Do style updates (not on reconnects)
                //
                if (!connected || approved) {
                    var fancyRoom = Room.getFancyName(response.roomName);

                    elChat.children('div.op').removeClass('title-primary');
                    
                    var room = response.roomList[response.roomName];
                    
                    var titleBar = $('<div />')
                        .addClass('op')
                        .addClass('title-primary')

                        .append($('<span/>', {'class': 'ui-icon ' + (room.roomFeatured ? 'ui-icon-star' : (room.roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet'))}))
                        .append($('<strong/>')
                            .text(fancyRoom + ' Room')
                        );
                            
                    if (User.isOp()) {
                        titleBar.append($('<a />', {
                            'href':  '#',
                            'rel':   response.roomName,
                            'title': (room.roomFeatured ? 'De-Feature Room' : 'Feature Room'),
                            'class': 'toggle-feature ui-icon ' + (room.roomFeatured ? 'ui-icon-bullet' : 'ui-icon-star')
                        }));
                    }
                        
                    elChat
                        .append(titleBar)
                            
                        .append($('<div />')
                            .addClass('bottom'));

                    if (topic) {
                        // Update status to say they joined                    
                        Action.message({
                            type:    'status',
                            message: 'The topic is \'' + topic + '\''
                        });
                    }

                    // Output buffer messages
                    for (var j in response.buffer) {
                        Action.message(response.buffer[j]);
                    }
                }

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                document.title = '(' + userCount + ') Chatlr | ' + fancyRoom

                // Sort rooms by featured then user count
                elRooms.children('div').chatlr('sortusers', Util.sort);

                // Clear all from being red, then make current room red and move to top
                elRooms.children('div').removeClass('op');
                elRooms.children('#r' + response.roomName).addClass('op').prependTo('#rooms');

                elCurrentRoom.children('.ui-icon').attr('class', 'ui-icon ' + (response.roomList[response.roomName].roomFeatured ? 'ui-icon-star' : (response.roomList[response.roomName].roomHidden ? 'ui-icon-comment' : 'ui-icon-bullet')));
                elCurrentRoom.children('.text').html(Room.getFancyName(response.roomName) + ' Room');
                
                // Remove possible dialog box with error warnings
                // Show the chat if not already shown and clear any possible timeouts
                elLoading.filter(':visible').fadeOut(250);
                elPulse.chatlr('stopstrobe');
                $('#dialog').remove();

                // Attach user blogs to the settings list
//                $('#bloglist').empty();
//                $.each(userBlogs, function(index, blog) {
//                    if (blog.name != clientId) {
//                        $('#bloglist').append($('<a>', {
//                            'id':   blog.name
//                        }).append($('<img>', {
//                            'src': 'http://api.tumblr.com/v2/blog/' + blog.name + '.tumblr.com/avatar/16'
//                        })).append($('<span>').text(blog.title)));
//                    }
//                });
                
                connected = true;
                approved  = true;
                
                // elScrollers.chatlr('scroll');
            
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
                User.display(response.user.name);                
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // DISCONNECTED: Remove user from sidebar and update count
        //
        disconnected: function(response) {
            console.log('triggered disconnected');
            
            if (response.id && response.id in users) {
                response.type = 'status';
                Action.message(response);
                
                // Remove user from side and delete
                elUsers.children('#u' + response.id).remove();
                delete users[response.id];

                // Update user counts on sidebar and in header
                userCount--;
                document.title = '(' + userCount + ') Chatlr';
                
                elScrollers.chatlr('scroll');
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // KICKED: Remove user from sidebar and update count
        //
        kicked: function(response) {
            Action.disconnected(response);
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // RECONNECTED: Set a user in sidebar as returned
        //
        reconnected: function(response) {
            console.log(response);
            
            if ('id' in response) {                
                var user = elUsers.children('#u' + response.id);
                
                if (user) {
                    user.removeClass('idle');

                    if ('op' in response) {
                        if (response.op) {
                            user.addClass('op');
                        } else {
                            user.removeClass('op');
                        }
                    }
                }
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // AWAY: Set a user in sidebar as idle
        //
        away: function(response) {
            if (response.id) {
                elUsers.children('#u' + response.id).addClass('idle');
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
                    elUsers.children('#u' + response.id).removeClass('idle');
                }

                // Display message
                if (typeof response == 'object') {
                    // Everything is pulled from the user list

                    var row     = $('<div/>'),
                        message = $('<span/>');

                    // Some status messages are from the server (no user)
                    if ('user' in response) {
                        var title = $('<div/>')
                                .text('Visit ' + Util.clean(response.user.title)),
                            link = $('<a/>')
                                .attr('href', Util.clean(response.user.url))
                                .attr('target', '_blank')
                                .attr('title', Util.clean(title.html()))
                                .text(Util.clean(response.user.name));

                        row.append($('<img/>').attr('src', Util.clean(response.user.avatar)));

                        if ('op' in response.user && response.user.op) {
                            link.addClass('op');
                        }
                    }

                    // Clean message then update usernames to tumblr links
                    response.message = Util.strip(response.message);
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
                    elChat.children('div:last').before(row.append(link).append(message));
                }

                // Scroll to the end of the page unless someone is hovering
                if (elBody.data('hoverbox') != 'chatbox') {
                    elChatbox.chatlr('scroll', elChat.outerHeight(true) - 6);
                }
            }
        },

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // STATUS: A grayed out message sent to everyone, does not require an ID
        //
        status: function(response) {
            Action.message(response);
        },
        
        userstatus: function(response) {
            // TODO
        }
    }
        
    var Init = {
        connect: function()
        {            
            socket = new io.connect();
                        
            // CONNECT: As soon as we connect, send credentials. Chat is still disabled at this time.
            socket.on('connect', function()
            {
                console.log('connection established');
            });
            
            // DISCONNECT: Attempt to reconnect immediately
            socket.on('disconnect', function()
            {
                console.log('disconnected');
                Util.notifyFailure(false);
            });

            // MESSAGE: Process a response from the server based on Action methods
            socket.on('message', function(response)
            {
                if (response.type && response.type in Action) {
                    // if (typeof console !== 'undefined') console.log(response.type);
                    Action[response.type](response);
                }
            });

            socket.on('connecting', function(type)
            {
                console.log('connecting with ' + type);
            });

            socket.on('connect_failed', function()
            {
                console.log('connect failed');
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
        },
        
        buttons: function()
        {
            // Setup Button Icons
            btnLogout.button({text: false, icons: {primary: 'ui-icon-power'}});
            btnHelp.button({text: false, icons: {primary: 'ui-icon-help'}});
            btnFollow.button({text: false, icons: {primary: 'ui-icon-plus'}});
                        
            $('#room-submit').button();
            
//            $('#button-settings').button({text: false, icons: {primary: 'ui-icon-wrench'}});            
        },
        
        events: function()
        {
            // CLICK EVENT: When buttons are clicked, show a popup
            btnHelp.on('click', DomEvent.popupHelp);

            // CLICK EVENT: Logout
            btnLogout.on('click', DomEvent.logout);

            // SUBMIT EVENT: Trigger text submission
            elForm.on('submit', DomEvent.submitText);

            
            elText
                // Process keys for helper methods
                .on('keydown', DomEvent.keydownText)
                
                // Store information on command keys
                .on('keyup', DomEvent.keyupText);
            
            $(document)
                // LIVE EVENT: User has clicked an external link, show prompt dialog
                .on('click', '.external', DomEvent.linkExternal)

                // LIVE EVENT: User has clicked a link for rooms, switch rooms
                .on('click', '#rooms a, .room', DomEvent.changeRooms)

                // LIVE EVENT: Show user dialog with extra features
                .on('click', '#users>div', DomEvent.popupUserInfo)
                
                // LIVE EVENT: Toggle featured room
                .on('click', '.toggle-feature', DomEvent.toggleFeatured);

            
            $(window)
                // RESIZE EVENT: Setup window sizing for any resize (and load)
                .on('resize', DomEvent.resizeWindow)
                .trigger('resize');
            
            elBody
                // TOUCH EVENT: Mobile scrolling event
                .on('touchstart touchmove', DomEvent.scrollMobile)

                // CLICK EVENT: Hide any popup using the bubbling trick
                .on('click', DomEvent.hidePopup);

            // CLICK EVENT: Dialog box to create a room for user
            btnRoom.on('click', DomEvent.popupCreateRoom)

            popCreateRoom.on('click', DomEvent.stopPropagation);
            
            elRoomForm.on('submit', DomEvent.createRoom);
            
            elRoomType.on('click', DomEvent.toggleRoomType);
        },
        
        dom: function()
        {
            // MOBILE: Hide headers on iPhone  
            window.top.scrollTo(0, 1);

            // Setup initial title
            document.title = 'Chatlr (Connecting...)'
            elPulse.chatlr('strobe'); 
            
            elLogout.hide();  
            
            popCreateRoom.hide();
        }
    };
    
    (function init() {
        // Call all of the init methods
        for (var i in Init) {
            Init[i]();
        }
    })();
});

       
        