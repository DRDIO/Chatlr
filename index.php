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
if (!$content || !isset($content->tumblelog) || !isset($content->tumblelog[0])) {
    session_unset();
    die('Cannot connect!');
}

$tumblr = (array) $content->tumblelog[0];
$tumblr = $tumblr['@attributes'];

$avatarType = substr($tumblr['avatar-url'], -4);

$tumblr['title']  = str_replace("'", "\'", $tumblr['title']);
$tumblr['avatar'] = substr($tumblr['avatar-url'], 0, -7) . '16' . $avatarType;

chmod('unix.socket', 0777);
$fp = fsockopen('unix://unix.socket', 0, $errNo, $errStr, 30);
if (!$fp) {
    die('Cannot establish credentials!' . $errStr);
} else {
    $result = fwrite($fp, json_encode(array(
        'id'     => $access_token['oauth_token'], 
        'title'  => $tumblr['title'],
        'name'   => $tumblr['name'],
        'url'    => $tumblr['url'],
        'avatar' => $tumblr['avatar'])));
  
    if (!$result) {
        die('Cannot write credentials!');
    }
}

?>

<!doctype html>
<html>
    <head>
        <title>Tumblr Chat</title>

        <link rel="stylesheet" href="http://ajax.googleapis.com/ajax/libs/jqueryui/1.7.2/themes/base/jquery-ui.css" type="text/css" />
        
        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.3/jquery.min.js"></script>
        <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.5/jquery-ui.min.js"></script>
        <script type="text/javascript" src="/js/json.js"></script>
        <script type="text/javascript" src="<?php echo SOCKET_URL; ?>"></script>
        <script type="text/javascript" src="/js/tumblrchat.js"></script>
        <script type="text/javascript">
            var tumblrTitle     = '<?php echo $tumblr['title']; ?>',
                tumblrName      = '<?php echo $tumblr['name']; ?>',
                tumblrUrl       = '<?php echo $tumblr['url']; ?>',
                tumblrAvatar    = '<?php echo $tumblr['avatar']; ?>';
        </script>

        <link rel="stylesheet" type="text/css" href="/css/design.css" />
    </head>
    <body>
        <div id="top">
            <h1 id="header">Tumblr Chat</h1>
            <div id="count"></div>
            <div style="float: left; padding: 0.9em 0 0 0.25em; color: 
#fff; 
text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.1); opacity: 0.5; ">
		This is not an official chat by Tumblr!
	    </div>

            <a class="topbuttons" title="About Tumblr Chat" href="" rel="page-about">
                ?
            </a>
            <a class="topbuttons" title="Find Another Room" href="">
                English Room
            </a>
            <a id="login" class="topbuttons" href="<?php echo htmlspecialchars($tumblr['url']); ?>" title="Change Chat Tumblr" target="_blank">
                <img src="<?php echo htmlspecialchars($tumblr['avatar']); ?>" alt="<?php echo htmlspecialchars($tumblr['name']); ?>" />
                <?php echo $tumblr['title']; ?>
            </a>
            <a class="toplink login" href="http://kevinnuut.com/" title="Visit KevinNuut.com!" target="_blank">
                <img src="http://28.media.tumblr.com/avatar_6ef19d797abb_16.png" alt="Visit KevinNuut.com" />
                Visit KevinNuut.com!
            </a>
        </div>

        <div id="usersbox">
            <div id="users"></div>
        </div>
        
        <div id="chatbox">
            <div id="chat">
            </div>
        </div>

        <form id="form" action="" method="post">
            <input id="text" type="text" autocomplete="off" placeholder="Type something and hit enter!" />
        </form>

        <div id="page-about" class="page">
            Tumblr Chat was created by
            <a href="http://kevinnuut.com/" title="Visit KevinNuut.com" target="_blank">Kevin Nuut</a>
            using 
            <a href="http://www.tumblr.com/oauth/apps" title="Visit Tumblr OAuth" target="_blank">Tumblr OAuth</a>,
            <a href="http://socket.io/" title="Visit Socket.IO" target="_blank">Socket.IO</a>,
            <a href="http://nodejs.org/" title="Visit Node.JS" target="_blank">Node.JS</a>,
            <a href="http://jquery.com/" title="Visit jQuery" target="_blank">jQuery</a>, and
            <a href="http://php.net/" title="Visit PHP" target="_blank">PHP</a>.  The views expressed in this
            chat do not necessarily represent the views of 
            <a href="http://staff.tumblr.com/" target="_blank">Tumblr</a>.  We use your credentials to read your
            blog titles, names, urls, and avatars.  We do not write anything to your blog.
            Have fun and be nice to others. <em>No bullying allowed!</em>
        </div>

        <div id="page-error" class="page">
            We are unable to connect you to Tumblr Chat at this time.  The server may be down.
            Tumblr Chat only works in
            <a href="http://www.apple.com/safari/" title="Get Safari!">Safari</a> and
            <a href="http://www.google.com/chrome/" title="Get Chrome!">Chrome</a>.
            If you are using Firefox or IE, you will need to switch browsers.
        </div>

        <div id="loading"><div id="loading-pulse"></div></div>
    </body>
</html>
