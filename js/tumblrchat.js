function message(obj){
    var el = document.createElement('p');
    if ('announcement' in obj) el.innerHTML = '<em>' + esc(obj.announcement) + '</em>';
    else if ('message' in obj) el.innerHTML = '<b>' + esc(obj.message[0]) + ':</b> ' + esc(obj.message[1]);
    document.getElementById('chat').appendChild(el);
    $('#chat').scrollTop($('#chat')[0].scrollHeight);
}

$(function() {
    $(window).resize(function(e) {
        $('#chat').scrollTop($('#chat')[0].scrollHeight);
    });

    $('#form').submit(function(e) {
        e.preventDefault();
        
        var val = $('#text').val();

        socket.send(val);
        message({message: ['you', val]});

        $('#text').val('');
    });

    $('#text').focus();
});

function esc(msg){
    return msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

var socket = new io.Socket(null, {
    port: 8080
});
socket.connect();
socket.on('message', function(obj){
    if ('buffer' in obj){
        document.getElementById('form').style.display='block';
        document.getElementById('chat').innerHTML = '';

        for (var i in obj.buffer) message(obj.buffer[i]);
    } else message(obj);
});