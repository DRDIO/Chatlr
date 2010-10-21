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

    } else if (response.type == 'personal') {
        $('#chat')
            .append($('<div/>')
		.addClass('personal')
                .append($('<img/>').attr('src', response.avatar))
                .append($('<a/>')
                    .attr('href', response.url)
                    .attr('target', '_blank')
                    .attr('title', 'Visit ' + response.title)
                    .text(response.name + ': '))
                .append($('<span/>').text(response.message)));

    } else if (response.type == 'connect') {
        $('#chat')
            .append($('<div/>')
                .addClass('connect')
                .append($('<img/>').attr('src', response.avatar))
                .append($('<a/>')
                    .attr('href', response.url)
                    .attr('target', '_blank')
                    .attr('title', 'Visit ' + response.title)
                    .text(response.name + ' '))
                .append($('<span/>').text('joined the chat!')));

    }
    
    $('#chat').scrollTop($('#chat')[0].scrollHeight);
}

$(function() {
    $(window).resize(function(e) {
        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    });

    var response = {
        avatar:  tumblrAvatar,
        title:   tumblrTitle,
        name:    tumblrName,
        url:     tumblrUrl};

    $('#form').submit(function(e) {
        e.preventDefault();
        
        var message = $('#text').val();

        response.type    = 'message';
        response.message = message;

        socket.send(response);

	response.type = 'personal';

        displayMessage(response);

        $('#text').val('');
    });

    var socket = new io.Socket(null, {port: 8080});

    socket.connect();

    response.type = 'connect';
    socket.send(response);

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
