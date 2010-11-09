<?php

session_start();
require_once 'auth/TumblrOAuth.php';
require_once '../config/credentials.php';

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

if (!isset($tumblr['name'])) {
    session_unset();
    die('Invalid Tumblr name!');
}

$avatarType = substr($tumblr['avatar-url'], -4);

$tumblr['title']  = str_replace("'", "\'", $tumblr['title']);
$tumblr['avatar'] = substr($tumblr['avatar-url'], 0, -7) . '16' . $avatarType;

$fp = fsockopen('unix://../unix.socket', 0, $errNo, $errStr, 30);
if (!$fp) {
    session_unset();
    die('Cannot establish credentials!' . $errStr);
}

$result = fwrite($fp, json_encode(array(
    'key'    => $access_token['oauth_token'],
    'time'   => time(),
    'user'   => array(
        'name'   => $tumblr['name'],
        'title'  => isset($tumblr['title'])  ? $tumblr['title']  : $tumblr['name'],
        'url'    => isset($tumblr['url'])    ? $tumblr['url']    : '',
        'avatar' => isset($tumblr['avatar']) ? $tumblr['avatar'] : '/img/space.png'))));

if (!$result) {
    session_unset();
    die('Cannot write credentials!');
}

// Load HTML
require_once 'index.phtml';

?>