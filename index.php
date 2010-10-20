<!doctype html>
<html>
    <head>
        <title>Tumblr Chat</title>

        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.3/jquery.min.js"></script>
        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.5/jquery-ui.min.js"></script>
        <script type="text/javascript" src="/js/json.js"></script>
        <script type="text/javascript" src="http://tumblrchat.loc:8080/socket.io/socket.io.js"></script>
        <script type="text/javascript" src="/js/tumblrchat.js"></script>

        <link rel="stylesheet" type="text/css" href="/css/design.css" />
    </head>
    <body>
        <h1 id="header">Tumblr Chat</h1>

        <div id="chatbox">
            <div id="chat">
                <p>Connecting...</p>
            </div>
        </div>

        <form id="form" action="" method="post">
            <input id="text" type="text" autocomplete="off" placeholder="Type something and hit enter!" />
        </form>
    </body>
</html>