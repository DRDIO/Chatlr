function displayMessage(response)
{
    if (response.type == 'message') {
        $('#chat')
            .append($('<div/>')
                .append($('<img/>').attr('src', response.avatar))
                .append($('<a/>')
                    .attr('href', response.url)
                    .attr('target', '_blank')
                    .attr('title', 'Visit ' + response.title)
                    .text(response.name + ': '))
                .append($('<span/>').text(response.message)));
    } else {
        $('#chat').append('<p>' + response.message[0] + ': ' + response.message[1])
    }
    
    $('#chat').scrollTop($('#chat')[0].scrollHeight);
}

$(function() {
    $(window).resize(function(e) {
        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    });

    $('#form').submit(function(e) {
        e.preventDefault();
        
        var message = $('#text').val();
        var response = {
            type:    'message',
            message: message,
            avatar:  tumblrAvatar,
            title:   tumblrTitle,
            name:    tumblrName,
            url:     tumblrUrl};

        socket.send(response);
        displayMessage(response);

        $('#text').val('');
    });

    var socket = new io.Socket(null, {port: 8080});

    socket.connect();
    socket.on('message', function(response)
    {
        if ('buffer' in response) {
            $('#form').show('blind', 200);            

            for (var i in response.buffer) {
                displayMessage(response.buffer[i]);
            }
        } else {
            displayMessage(response);
        }
    });

    $('#chat').val('');
});