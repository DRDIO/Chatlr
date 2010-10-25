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

var socket;

$(function() {
    $('title').text('Tumblr Chat (Connecting...)');
    $('#loading-pulse').dotdotdot();
    
    // Initialize variables
    var clientId,
        users,
        lastTimestamp = 0,
        lastMessage   = '';

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // Connect to socket server
    if (typeof io == 'undefined') {
        notifyFailure(false);
    } else {

        socket = new io.Socket(null, {
            port: 8080,
            transports: ['websocket']});
        socket.connect();

        setTimeout("notifyFailure(true)", socket.options.connectTimeout);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        socket.on('message', function(serverRes)
        {
            // Only accept messages with type property
            if ('type' in serverRes && serverRes.type in {'init': '', 'message': '', 'status': ''}) {
                // First message sent from server, initalize chat
                if (serverRes.type == 'init') {
                    socket.send({
                        type:  'credentials',
                        token: tumblrToken});

                    // Save self ID for later reference
                    clientId = serverRes.id;

                    // Initialize self user with php vars
                    // On init, a list of users is grabbed (and add yourself)
                    users = serverRes.users;

                    // Add users to the chat list
                    var userCount = 0;
                    for (var i in users) {
                        displayUser(i);
                        userCount++;
                    }
                    
                    // Output buffer messages
                    for (var j in serverRes.buffer) {
                        displayMessage(serverRes.buffer[j]);
                    }

                    // Update status to say they joined
                    var joinedRes = {
                        type:    'status',
                        message: 'The topic is ' + serverRes.topic + '...'};
                    displayMessage(joinedRes);

                    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

                    $('#count').text(userCount);
                    $('title').text('Tumblr Chat');
                    $('#loading').fadeOut(1000);

                // If a new user is coming or going, update list accordingly
                } else if (serverRes.type == 'status' && 'mode' in serverRes && serverRes.mode in {'connect': '', 'disconnect': ''} && 'id' in serverRes) {
                    // new user joined, let's add to user list!
                    if (serverRes.mode == 'connect' && 'user' in serverRes) {
                        users[serverRes.id] = serverRes.user;
                        $('#count').text(1 + parseInt($('#count').text()));
                        displayUser(serverRes.id);

                        // Don't display if so many people are on, its too spammy
                        if (parseInt($('#count').text()) < 10) {
                            serverRes.message = ' has joined the chat!';
                            displayMessage(serverRes);
                        }

                    // Awh, a user left, let's remove from user list
                    } else if (serverRes.mode == 'disconnect') {
                        // Pull users from local list and display disconnect
                        serverRes.user = users[serverRes.id];

                        // Don't display if so many people are on, its too spammy
                        if (parseInt($('#count').text()) < 10) {
                            serverRes.message = ' has left the chat...';
                            displayMessage(serverRes);
                        }

                        // Remove local user
                        $('#count').text(-1 + parseInt($('#count').text()));
                        removeUser(serverRes.id);
                        delete users[serverRes.id];
                    }

                // Otherwise, process whatever message or generic status comes in
                } else if (serverRes.type == 'message' || serverRes.type == 'status') {
                    // Pull users from local array and display message or status
                    serverRes.user = users[serverRes.id];
                    displayMessage(serverRes);
                }
            }
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: If mouse is down, prevent scroll from moving to bottom of screen
        $(window).mousedown(function(e) {
           mouseDown = true;
        });

        // EVENT: If mouse is up, scrolling is cool
        $(window).mouseout(function(e) {
            mouseDown = false;
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: On resize, move to bottom of the screen
        $(window).resize(function(e) {
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
                .dialog({
                    width: '40%',
                    minWidth: '320px',
                    resizable: false})
                .html(message)
                .parent().position({my: 'center', at: 'center', of: document});
        });

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: When the text box is submitted, prevent submission and send message
        $('#form').submit(function(e) {
            e.preventDefault();
            var message   = $('#text').val();
            var timestamp = new Date().getTime();

            if (message == lastMessage || timestamp - lastTimestamp < 3000 || message.length > 350) {
                // Quickly display message to self in pink
                displayMessage({
                    type:    'status',
                    user:    users[clientId],
                    message: 'Ignored as spam due to repetition, length, or frequency.'});
            } else {
                lastMessage   = message;
                lastTimestamp = timestamp;

                // I hate follow me requests, and dumb questions
                message = message.replace(/follow/i, "touch");
                message = message.replace(/what is this\??/i, "...This is Tumblr Chat...");
                message = message.replace(/is this (for )?real\??/i, "...Tumblr Chat is real...");
                message = message.replace(/(did )?(who|tumblr) made this\??/i, "...Kevin Nuut made this...");

                // Random fun time messages                
                message = message.replace(/cake/i, "...The cake is a lie...");

                // I hate similar charactesr in a row
                message = message.replace(/(.+?)\1{3,}/g, '$1');
                
                // I also hate capslocking
                if (message.search(/[A-Z ]{5,}/) != -1) {
                    message = message.toLowerCase();
                }

                // MADNESS!
                message = message.replace(/this is madness/i, "...This is SPARTA!...");

                // Send to server for broadcast
                socket.send({
                    type: 'message',
                    message: message});

                // Quickly display message to self in pink
                displayMessage({
                    type:    'personal',
                    user:    users[clientId],
                    message: message});

                // Clear text box
                $('#text').val('');
            }
        });
    }
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

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
                    row.addClass('op');
                }
            }

            // MESSAGE: The default message from a user
            if (response.type == 'message') {
                message.text(clean(': ' + response.message));

            // PERSONAL: Personal messages are pink but otherwise look like messages
            } else if (response.type == 'personal') {
                row.addClass('personal');
                message.text(clean(': ' + response.message));

            // STATUS: Status messages just show a faded message
            } else if (response.type == 'status') {
                row.addClass('status');
                message.text(clean(' ' + response.message));
            }

            // insert message
            $('#chat').append(row.append(link).append(message));
        }
        
        // Scroll to the end of the page unless mouse is down
        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    }

    function displayUser(id)
    {
        var user;
        if ($('#users #u' + id).length) {
            user = $('#users #u' + id);
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

        if (id == clientId) {
            user.addClass('personal');
            $('#users').prepend(user);
        } else {
            $('#users').append(user);
        }

        if ('op' in users[id] && users[id].op) {
            user.addClass('op');
        }
    }

    function removeUser(id)
    {
        $('#users #u' + id).remove();
    }

    function clean(message)
    {
        return $('<div/>').text(message).text();
    }
});

function notifyFailure(hasSocket)
{
    if (!hasSocket || (!socket.connecting && !socket.connected)) {
        // Stop logo pulsing and make sure the background is faded in
        $('#loading-pulse').dotdotend();
        $('#loading').fadeIn(250);

        $('title').text('Tumblr Chat (Error!)');

        $('<div/>')
            .attr('title', 'Unable to Connect')
            .dialog({
                width: '40%',
                minWidth: '320px',
                resizable: false})
            .html($('#page-error').html() + '<br/><br/>' + $('#page-about').html())
            .parent().position({my: 'top', at: 'top', of: document, offset: '0 24'});
    }
}
