$.fn.dotdotdot = function() {
    this.each(function() {
        $(this).fadeTo(500, 0.5).fadeTo(500, 1.0, function() {
            $(this).dotdotdot();
        });
    });
};

$.fn.dotdotend = function() {
    this.each(function() {
        $(this).stop(true).fadeTo(5000, 0.1);
    });
};

/**
 * jQuery.fn.sortElements
 * --------------
 * @param Function comparator:
 *   Exactly the same behaviour as [1,2,3].sort(comparator)
 *
 * @param Function getSortable
 *   A function that should return the element that is
 *   to be sorted. The comparator will run on the
 *   current collection, but you may want the actual
 *   resulting sort to occur on a parent or another
 *   associated element.
 *
 *   E.g. $('td').sortElements(comparator, function(){
 *      return this.parentNode;
 *   })
 *
 *   The <td>'s parent (<tr>) will be sorted instead
 *   of the <td> itself.
 */
jQuery.fn.sortElements = (function(){

    var sort = [].sort;

    return function(comparator, getSortable) {

        getSortable = getSortable || function(){return this;};

        var placements = this.map(function(){

            var sortElement = getSortable.call(this),
                parentNode = sortElement.parentNode,

                // Since the element itself will change position, we have
                // to have some way of storing its original position in
                // the DOM. The easiest way is to have a 'flag' node:
                nextSibling = parentNode.insertBefore(
                    document.createTextNode(''),
                    sortElement.nextSibling
                );

            return function() {

                if (parentNode === this) {
                    throw new Error(
                        "You can't sort elements if any one is a descendant of another."
                    );
                }

                // Insert before flag:
                parentNode.insertBefore(this, nextSibling);
                // Remove flag:
                parentNode.removeChild(nextSibling);

            };

        });

        return sort.call(this, comparator).each(function(i){
            placements[i].call(getSortable.call(this));
        });

    };

})();

var socket,
    attempts   = 0,
    timeoutId  = null,
    reconnects = 0,
    tempHash   = sessionStorage.getItem('hash');

sessionStorage.clear();

$(function() {
    window.scrollTo(0, 1);

    document.title = 'TumblrChat (Connecting...)'
    $('#loading-pulse').dotdotdot();

    // Initialize variables
    var clientId,
        users         = {},
        ignore        = {},
        userCount     = 0,
        lastTimestamp = 0,
        lastMessage   = '',
        topic         = '',
        isMobile      = false,
        lastScroll    = 0,
        hashRoom      = roomUrlGet(tempHash) || 'main',
        connected     = false,
        approved      = false;
        
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Connect to socket server
    if (typeof io == 'undefined') {
        notifyFailure(false);
    } else {
        socket = new io.Socket(null, {rememberTransport: false, transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']});

        // Try to connect (using multiple tries if necessary)
        chatConnect();

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // CONNECT > SEND CREDENTIALS
        // As soon as we connect, send credentials. Chat is still disabled at this time.
        socket.on('connect', function()
        {
            // Clear reconnect timeout and set to 0 for attempts
            $('#header').attr('title', reconnects);
            clearTimeout(timeoutId);
            attempts = 0;

            // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            // Attempt to change rooms on the fly

            var currentRoom = roomUrlGet();

            if (currentRoom && currentRoom != 'main') {
                socket.send({
                   type: 'roomchange',
                   room: currentRoom});
            }
        });

        socket.on('disconnect', function()
        {
            approved = false;
            reconnects++;            
            chatConnect();
        });

        socket.on('message', function(serverRes)
        {
            // Only accept messages with type property
            if ('type' in serverRes && serverRes.type in {'approved': '', 'message': '', 'status': '', 'topic': '', 'room': ''}) {
                // ROOMS
                if (serverRes.type == 'room' && 'mode' in serverRes && serverRes.mode in {'delete': '', 'change': ''}) {
                    var fancyRoom = roomGetFancyName(serverRes.room);

                    if (serverRes.mode == 'delete') {
                        // Delete room from list
                        $('#rooms #r' + serverRes.room).remove();
                    } else {
                        // Update or add room to list
                        var roomObj   = $('#rooms #r' + serverRes.room);

                        if (roomObj.length) {
                            roomObj.find('sup').text(serverRes.count);
                            roomObj.find('a').text(fancyRoom);
                        } else {                            
                            roomObj = $('<div/>')
                                .attr('id', 'r' + serverRes.room)
                                .append($('<sup/>').text(serverRes.count))
                                .append($('<a/>')
                                    .attr('href', '#' + serverRes.room)
                                    .text(fancyRoom));
                                
                            if (serverRes.featured) {
                                $('#rooms').append(roomObj);
                            } else {
                                $('#rooms').append(roomObj);
                            }
                        }
                    }
                }

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                // First message sent from server, initalize chat
                else if (serverRes.type == 'topic') {
                    topic = serverRes.topic;
                    displayMessage({
                        type: 'status',
                        message: 'The topic is now \'' + topic + '\'...'});
                }

                // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                else if (serverRes.type == 'approved') {
                    // Save self ID for later reference
                    clientId = serverRes.id;
                    var roomName = serverRes.room;

                    // Initialize self user with php vars
                    // On init, a list of users is grabbed (and add yourself)
                    users = serverRes.users;

                    // Add users to the chat list
                    clearUsers(i);
                    userCount = 0;
                    for (var i in users) {
                        displayUser(i);
                        userCount++;
                    }

                    // Update room hash
                    roomUrlChange(roomName == 'main' ? '' : roomName);

                    // Do style updates (not on reconnects)
                    if (!connected || approved) {
                        var fancyRoom = roomGetFancyName(roomName);

                        // Set Room title and dividers
                        $('#chat')
                            .append($('<b />')
                                .addClass('divider')
                                .append($('<b />')
                                    .addClass('bottom'))
                                .append($('<b />')
                                    .addClass('top')))
                            .append($('<div />')
                                .addClass('op')
                                .text(fancyRoom + ' Room'));

                        // Update status to say they joined
                        topic = serverRes.topic;
                        displayMessage({
                            type:    'status',
                            message: 'The topic is \'' + topic + '\'...'});

                        // Output buffer messages
                        for (var j in serverRes.buffer) {
                            displayMessage(serverRes.buffer[j]);
                        }
                    }

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    $('#count').text(userCount);
                    document.title = '(' + userCount + ') TumblrChat | ' + fancyRoom

                    // Sort rooms alphabetically
                    $('#rooms div').sortElements(function(a, b) {
                        return $(a).find('sup').text() < $(b).find('sup').text() ? 1 : -1;
                    });

                    // Clear all from being red, then make current room red and move to top
                    $('#rooms div').removeClass('op');
                    $('#rooms #r' + roomName).addClass('op').insertAfter('#roomadd');

                    // Remove possible dialog box with error warnings
                    // Show the chat if not already shown and clear any possible timeouts
                    $('#loading:visible').fadeOut(250);
                    $('#error:visible').remove();
                    $('#loading-pulse').dotdotend();
                    $('#dialog').remove();

                    connected = true;
                    approved  = true;

                // If a new user is coming or going, update list accordingly
                } else if (serverRes.type == 'status' && 'mode' in serverRes && serverRes.mode in {'reconnect': '', 'idle': '', 'away': '', 'connect': '', 'disconnect': ''} && 'id' in serverRes) {
                    // User is reconnected
                    if (serverRes.mode == 'reconnect' && serverRes.id in users) {
                        $('#u' + serverRes.id).removeClass('idle');

                    // User is set to away or disconnected
                    } else if ((serverRes.mode == 'idle' || serverRes.mode == 'away') && serverRes.id in users) {
                        $('#u' + serverRes.id).addClass('idle');

                        // Don't display if so many people are on, its too spammy
                        if (userCount < 10 && serverRes.mode == 'away') {
                            serverRes.user    = users[serverRes.id];
                            serverRes.message = ' has gone away...';
                            displayMessage(serverRes);
                        }

                    // new user joined, let's add to user list!
                    } else if (serverRes.mode == 'connect' && 'user' in serverRes && !(serverRes.id in users)) {
                        users[serverRes.id] = serverRes.user;
                        $('#count').text(++userCount);
                        document.title = '(' + userCount + ') TumblrChat';

                        // Display user on side
                        displayUser(serverRes.id);

                        // Don't display if so many people are on, its too spammy
                        if (userCount < 10) {
                            serverRes.message = ' has joined the chat!';
                            displayMessage(serverRes);
                        }

                    // Awh, a user left, let's remove from user list
                    } else if (serverRes.mode == 'disconnect' && serverRes.id in users) {
                        // Pull users from local list and display disconnect
                        serverRes.user = users[serverRes.id];

                        // Don't display if so many people are on, its too spammy
                        if (userCount < 10) {
                            serverRes.message = ' has left the chat...';
                            displayMessage(serverRes);
                        }

                        // Remove local user
                        $('#count').text(--userCount);
                        document.title = '(' + userCount + ') TumblrChat';

                        // Remove user from side and delete
                        removeUser(serverRes.id);
                        delete users[serverRes.id];
                    }

                // Otherwise, process whatever message or generic status comes in
                } else if (serverRes.type == 'message' || serverRes.type == 'status') {
                    // Either there is no ID to attach or ID is in user list and not in ignore list
                    if (!('id' in serverRes) || (serverRes.id in users && !(users[serverRes.id].name in ignore))) {
                        // Pull users from local array and display message or status
                        if (serverRes.id in users) {
                            $('#u' + serverRes.id).removeClass('idle');                            
                            serverRes.user = users[serverRes.id];
                        }

                        displayMessage(serverRes);
                    }
                }
            }
        }); // end onMessage()

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: On resize, move to bottom of the screen
        $(window).resize(function(e) {
            lastScroll = $('#chat').scrollTop();
            $('#chat').scrollTop($('#chat')[0].scrollHeight);
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        $('.topbuttons').click(function(e) {
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
                    width: $(window).width() * 0.8,
                    maxWidth: 320,
                    minHeight: 0,
                    height: $(window).height() * 0.8,
                    resizable: false,
                    close: function() {
                        $(this).remove()}})                
                .parent().position({my: 'center', at: 'center', of: document});
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: When the text box is submitted, prevent submission and send message
        $('#form').submit(function(e) {
            e.preventDefault();
            var message   = $('#text').val();
            var timestamp = new Date().getTime();

            if (message.search(/^\/mobile/i) == 0) {
                if (!isMobile) {
                    isMobile = true;
                    $('.topbuttons, .toplink, #notice').fadeOut(250);
                    $('#chat').css({overflowY: 'hidden'});
                    $('#usersbox').animate({width: '0%', opacity: 0}, 250);
                    $('#chatbox').animate({width: '100%'}, 250);
                } else {
                    isMobile = false;
                    $('.topbuttons, .toplink, #notice').fadeIn(250);
                    $('#chat').css({overflowY: 'auto'});
                    $('#usersbox').animate({width: '15%', opacity: 1}, 250);
                    $('#chatbox').animate({width: '85%'}, 250);
                }

                // No matter what, go to bottom of the page
                lastScroll = $('#chat').scrollTop();
                $('#chat').scrollTop($('#chat')[0].scrollHeight);
                $('#text').val('');

            } else if (message.search(/^\/room !?[a-z0-9-]{2,16}$/i) == 0) {
                var newRoom = message.substr(6).toLowerCase();

                // If a connection exists, send a roomchange event
                socket.send({
                    type: 'roomchange',
                    room: newRoom});
                $('#text').val('');
                
            } else if (message.search(/^\/topic$/i) == 0) {
                displayMessage({
                    type:    'status',
                    message: 'The topic is \'' + topic + '\'...'});
                $('#text').val('');

            } else if (message.search(/^\/help$/i) == 0) {
                $('#button-help').click();
                $('#text').val('');

            } else if (message.search(/^\/ignore [a-z0-9-]+$/i) == 0) {
                var name = message.substr(8);
                if (name in ignore) {
                    delete ignore[name];
                    $('#text').val('');
                    for (var i in users) {
                        if (name == users[i].name) {
                            $('#u' + i).removeClass('ignore');
                        }
                    }
                } else {
                    ignore[name] = '';
                    $('#text').val('');
                    for (var i in users) {
                        if (name == users[i].name) {
                            $('#u' + i).addClass('ignore');
                        }
                    }
                }

            } else if (clientId in users && 'op' in users[clientId] && !users[clientId].op && (message == lastMessage || timestamp - lastTimestamp < 2000 || message.length > 350)) {
                // Quickly display message to self in pink
                displayMessage({
                    type:    'status',
                    user:    users[clientId],
                    message: 'Ignored as spam due to repetition, length, or frequency.'});
            } else {
                lastMessage   = message;
                lastTimestamp = timestamp;

                // Send to server for broadcast
                socket.send({
                    type: 'message',
                    message: message});

                // Clear text box
                $('#text').val('');
            }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // User has clicked an external link, show prompt dialog
        $('.external').live('click', function(e) {
            e.preventDefault();
            
            var url = $(this).attr('href');
            
            $('<div/>')
                .attr('title', 'Visit External Link?')
                .html('<em>' + url + '</em> You are about to open an external link that might be offensive or contain viruses. Do you still want to visit it?')
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
                    width: $(window).width() * 0.8,
                    maxWidth: 320,
                    minHeight: 0,
                    maxHeight: $(window).height() * 0.8,
                    resizable: false})
                .parent().position({my: 'center', at: 'center', of: document});
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // User has clicked a link for rooms, switch rooms
        $('#rooms a, .room').live('click', function(e) {
           e.preventDefault();
           var newRoom = $(this).attr('href').substr(1);

           if(socket.connected && newRoom != (roomUrlGet() || 'main')) {
               // If a connection exists, send a roomchange event
               socket.send({
                   type: 'roomchange',
                   room: newRoom
               });
           }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Add Room
        
        $('#roomadd').submit(function(e) {
            e.preventDefault();

            // Get room and format it to be a url
            var newRoom = $('#roomadd input').val();
            newRoom = roomGetUrlName(newRoom);

            // Clear window and remove focus
            $('#roomadd input').val('');
            $('#text').focus();
            
            if(socket.connected && newRoom != (roomUrlGet() || 'main')) {
                // If a connection exists, send a roomchange event
                socket.send({
                    type: 'roomchange',
                    room: newRoom
                });
            }
        });
    }
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    function roomGetUrlName(fancyName)
    {
        var name  = $.trim(fancyName.toLowerCase());
        var first = name.substr(0, 1).replace(/[^a-z0-9!]/, '');
        var rest  = name.substr(1, 15).replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
        
        return first + rest;
    }

    function roomGetFancyName(roomName)
    {
        if (roomName.charAt(0) == '!') {
            roomName = roomName.substr(1);
        }
        
        var parts = roomName.split('-');
        for (var i in parts) {
            parts[i] = parts[i].substr(0, 1).toUpperCase() + parts[i].substr(1);
        }
        
        return parts.join(' ');
    }

    // FUNCTION: Display various message types to the screen
    function displayMessage(response)
    {
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
            response.message = response.message.replace(/(https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_.-]*(\?\S+)?)?)?)/g, '<a href="$1" class="external" title="Visit External Link!" target="_blank"><strong>[link]</strong></a>');
            response.message = response.message.replace(/(^| )@([a-z0-9-]+)($|[' !?.,:;])/gi, '$1<a href="http://$2.tumblr.com/" title="Visit Their Tumblr!" target="_blank"><strong>@$2</strong></a>$3');
            response.message = response.message.replace(/(#(!?[a-z0-9-]{2,16}))/gi, '<a href="$1" class="room" title="Go to $2 Room">$1</a>');
            
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
            $('#chat').append(row.append(link).append(message));
        }
        
        // Scroll to the end of the page unless mouse is down
        var thisScroll = $('#chat').scrollTop();
        if (thisScroll >= lastScroll) {
            lastScroll = thisScroll;
            $('#chat').scrollTop($('#chat')[0].scrollHeight);
        }
    }

    function clearUsers()
    {
        $('#users').html('');
    }

    function displayUser(id)
    {
        if (id in users) {
            var user;
            if ($('#users #u' + id).length) {
                user = $('#users #u' + id).empty();
            } else {
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

            if ('op' in users[id] && users[id].op) {
                user.addClass('op');
            }
        }
    }

    function removeUser(id)
    {
        $('#users #u' + id).remove();
    }

    function clean(message)
    {
        return (message ? $('<div/>').text(message).text() : '');
    }

    function strip(message)
    {
        return $('<div/>').text(message).html();
    }
});

function chatConnect()
{
    if (typeof socket != 'undefined') {
        // Try connecting 3 times (reset to 0 on successful connect)
        if (attempts < 3) {
            if (!socket.connecting && !socket.connected) {
                attempts++;
                socket.connect();
            }

            // Check back after timeout for another attempt
            timeoutId = setTimeout('chatConnect()', socket.options.connectTimeout);
        } else {
            notifyFailure();
        }
    } else {
        notifyFailure();
    }
}

function notifyFailure(hasSocket)
{
    if (!hasSocket || (!socket.connecting && !socket.connected)) {
        // Stop logo pulsing and make sure the background is faded in
        $('#loading-pulse').dotdotend();
        $('#loading').fadeIn(250);

        document.title = 'TumblrChat (Error!)'

        $('<div/>')
            .attr('id', 'error')
            .attr('title', 'Unable to Connect')
            .html($('#page-error').html() + '<br/><br/>' + $('#page-about').html())
            .dialog({
                width: $(window).width() * 0.8,
                maxWidth: 320,
                minHeight: 0,
                maxHeight: $(window).height() * 0.8,
                resizable: false})
            .parent().position({my: 'top', at: 'top', of: document, offset: '0 24'});
    }
}

function roomUrlChange(path)
{
    if (typeof(window.history.pushState) == 'function') {
        window.history.pushState(null, path, '/' + path);
    } else {
        window.location.hash = '#!' + path;
    }
}

function roomUrlGet(tempHash)
{
    if (typeof(window.history.pushState) == 'function') {
        var url       = window.location.href;
        var firstHash = url.indexOf('#');

        firstHash = (firstHash == -1 ? url.length : firstHash);
        url       = url.substring(0, firstHash);

        var lastSlash = url.lastIndexOf('/');

        return url.substr(lastSlash + 1);
    } else {
        if (tempHash) {
            roomUrlChange(tempHash);
            return tempHash;
        } else {
            var hash = window.location.hash;
            var mark = hash.indexOf('#!');

            return (mark == -1 ? defRoom : hash.substr(mark + 2));
        }
    }
}