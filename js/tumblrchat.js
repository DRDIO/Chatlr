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

        socket = new io.Socket(null, {port: 8080, transports: ['websocket']});
        socket.connect();

        setTimeout("notifyFailure(true)", socket.options.connectTimeout);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // EVENT: When receiving a message from the server
        socket.on('message', function(serverRes)
        {
            // Only accept messages with type property
            if ('type' in serverRes && serverRes.type in {'init': '', 'message': '', 'status': ''}) {
                // First message sent from server, initalize chat
                if (serverRes.type == 'init' && 'id' in serverRes && 'users' in serverRes) {
                    // Initialize self user with php vars
                    clientId = serverRes.id;

                    var selfCreds = {
                        title:  tumblrTitle,
                        name:   tumblrName,
                        url:    tumblrUrl,
                        avatar: tumblrAvatar};

                    // On init, a list of users is grabbed (and add yourself)
                    users = serverRes.users;
                    users[clientId] = selfCreds;

                    // Send a connect message with credentials
                    selfCreds.type = 'credentials';
                    socket.send(selfCreds);

                    // Add users to the chat list
                    var userCount = 0;
                    for (var i in users) {
                        displayUser(i);
                        userCount++;
                    }

                    // Update user count up top
                    $('#count').text(userCount);

                    // Output buffer messages
                    for (var i in serverRes.buffer) {
                        displayMessage(serverRes.buffer[i]);
                    }

                    // Update status to say they joined
                    var joinedRes = {
                        type:    'status',
                        user:    users[clientId],
                        message: 'joined the chat!'};
                    displayMessage(joinedRes);

                    $('#loading').fadeOut(1000);

                // If a new user is coming or going, update list accordingly
                } else if (serverRes.type == 'status' && 'mode' in serverRes && serverRes.mode in {'connect': '', 'disconnect': ''} && 'id' in serverRes) {
                    // new user joined, let's add to user list!
                    if (serverRes.mode == 'connect' && 'user' in serverRes) {
                        users[serverRes.id] = serverRes.user;
                        $('#count').text(1 + parseInt($('#count').text()));
                        displayUser(serverRes.id);
                        if (parseInt($('#count').text()) < 20) {
                            displayMessage(serverRes);
                        }

                    // Awh, a user left, let's remove from user list
                    } else if (serverRes.mode == 'disconnect') {
                        // Pull users from local list and display disconnect
                        serverRes.user = users[serverRes.id];
                        if (parseInt($('#count').text()) < 20) {
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

            if (message == lastMessage || timestamp - lastTimestamp < 2500) {
                // Quickly display message to self in pink
                displayMessage({
                    type:    'status',
                    user:    users[clientId],
                    message: 'Ignored as spam due to repetition or frequency.'});
            } else {
                lastMessage   = message;
                lastTimestamp = timestamp;

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

            var title = $('<div/>')
                    .text('Visit ' + clean(response.user.title)),

                row = $('<div/>')
                    .append($('<img/>').attr('src', clean(response.user.avatar))),

                link = $('<a/>')
                    .attr('href', clean(response.user.url))
                    .attr('target', '_blank')
                    .attr('title', clean(title.html()))
                    .text(clean(response.user.name)),

                message = $('<span/>');
            
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
        $('#loading-pulse').dotdotend();
        
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