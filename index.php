<?php

session_start();
require_once 'auth/TumblrOAuth.php';
require_once 'config/credentials.php';

if (empty($_SESSION['access_token']) || empty($_SESSION['access_token']['oauth_token']) || empty($_SESSION['access_token']['oauth_token_secret'])) {
    session_unset();

    /* Build TumblrOAuth object with client credentials. */
    $connection = new TumblrOAuth(CONSUMER_KEY, CONSUMER_SECRET);

    /* Get temporary credentials. */
    $request_token = $connection->getRequestToken(OAUTH_CALLBACK);

    /* Save temporary credentials to session. */
    $_SESSION['oauth_token'] = $token = $request_token['oauth_token'];
    $_SESSION['oauth_token_secret'] = $request_token['oauth_token_secret'];
    
    /* If last connection failed don't display authorization link. */
    switch ($connection->http_code) {
        case 200:
            /* Build authorize URL and redirect user to Twitter. */
            $url = $connection->getAuthorizeURL($token);
            header('Location: ' . $url);
        default:
            /* Show notification if something went wrong. */
            echo 'Could not connect to Tumblr. Refresh the page or try again later.';
    }

    exit;
}

/* Get user access tokens out of the session. */
$access_token = $_SESSION['access_token'];

/* Create a TumblrOAuth object with consumer/user tokens. */
$connection = new TumblrOAuth(CONSUMER_KEY, CONSUMER_SECRET, $access_token['oauth_token'], $access_token['oauth_token_secret']);

/* If method is set change API call made. Test is called by default. */
$content = $connection->post('api/authenticate');
$tumblr  = (array) $content->tumblelog[0];
$tumblr  = $tumblr['@attributes'];

$avatarType = substr($tumblr['avatar-url'], -4);

$tumblr['title']  = htmlspecialchars($tumblr['title'], ENT_QUOTES);
$tumblr['avatar'] = substr($tumblr['avatar-url'], 0, -7) . '24' . $avatarType;
$tumblr['smatar'] = substr($tumblr['avatar-url'], 0, -7) . '16' . $avatarType;

?>

<!doctype html>
<html>
    <head>
        <title>Tumblr Chat</title>

        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.3/jquery.min.js"></script>
        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.5/jquery-ui.min.js"></script>
        <script type="text/javascript" src="/js/json.js"></script>
        <script type="text/javascript" src="http://tumblrchat.com:8080/socket.io/socket.io.js"></script>
        <script type="text/javascript" src="/js/tumblrchat.js"></script>
        <script type="text/javascript">
            var tumblrTitle     = '<?php echo $tumblr['title']; ?>',
                tumblrName      = '<?php echo $tumblr['name']; ?>',
                tumblrUrl       = '<?php echo $tumblr['url']; ?>',
                tumblrAvatar    = '<?php echo $tumblr['smatar']; ?>';
        </script>

        <link rel="stylesheet" type="text/css" href="/css/design.css" />
    </head>
    <body>
        <div id="top">
            <h1 id="header">Tumblr Chat</h1>
            <div id="login">
                <a href="<?php echo $tumblr['url']; ?>" title="Visit <?php echo $tumblr['title']; ?>" target="_blank">
                    <?php echo $tumblr['name']; ?>
                    <img src="<?php echo $tumblr['avatar']; ?>" alt="<?php echo $tumblr['name']; ?>" />
                </a>
            </div>
        </div>

        <div id="chatbox">
            <div id="chat">
            </div>
        </div>

        <form id="form" action="" method="post">
            <input id="text" type="text" autocomplete="off" placeholder="Type something and hit enter!" />
        </form>
    </body>
</html>
