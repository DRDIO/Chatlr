$(function() {
    // Initialize variables
    var clientId,
        users,
        mouseDown = false,
        socket    = new io.Socket(null, {port: 8080});

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // Connect to socket server
    socket.connect();

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

            // If a new user is coming or going, update list accordingly
            } else if (serverRes.type == 'status' && 'mode' in serverRes && serverRes.mode in {'connect': '', 'disconnect': ''} && 'id' in serverRes) {
                // new user joined, let's add to user list!
                if (serverRes.mode == 'connect' && 'user' in serverRes) {
                    users[serverRes.id] = serverRes.user;
                    $('#count').text(1 + parseInt($('#count').text()));
                    displayUser(serverRes.id);                    
                    displayMessage(serverRes);
                    
                // Awh, a user left, let's remove from user list
                } else if (serverRes.mode == 'disconnect') {
                    // Pull users from local list and display disconnect
                    serverRes.user = users[serverRes.id];
                    displayMessage(serverRes);

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

            // Scroll to the end of the page unless mouse is down
            if (!mouseDown) {
                $('#chat').scrollTop($('#chat')[0].scrollHeight);
            }
        }
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // EVENT: If mouse is down, prevent scroll from moving to bottom of screen
    $(window).mousedown(function(e) {
       mouseDown = true;
    });

    // EVENT: If mouse is up, scrolling is cool
    $(window).mouseup(function(e) {
        mouseDown = false;
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // EVENT: On resize, move to bottom of the screen
    $(window).resize(function(e) {
        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    });

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // EVENT: When the text box is submitted, prevent submission and send message
    $('#form').submit(function(e) {
        e.preventDefault();

        var message = $('#text').val();

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
    });

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

        $('#users').append(user);
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
