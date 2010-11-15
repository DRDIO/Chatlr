<?php

try {
    session_start();
    require_once 'auth/TumblrOAuth.php';
    require_once '../config/credentials.php';

    // No session created so set one up.  This will route to Tumblr.
    if (!isset($_SESSION['access_token']) || !isset($_SESSION['access_token']['oauth_token']) || !isset($_SESSION['access_token']['oauth_token_secret'])) {
        session_unset();

        /* Build TumblrOAuth object with client credentials. */
        $connection = new TumblrOAuth(CONSUMER_KEY, CONSUMER_SECRET);

        /* Get temporary credentials. */
        $requestToken = $connection->getRequestToken(OAUTH_CALLBACK);
        if (empty($requestToken)) {
            throw new Exception('Could not make initial request to Tumblr.');
        }
        
        /* Save temporary credentials to session. */
        $_SESSION['oauth_token'] = $token = $requestToken['oauth_token'];
        $_SESSION['oauth_token_secret'] = $requestToken['oauth_token_secret'];

        /* If last connection failed don't display authorization link. */
        switch ($connection->http_code) {
            case 200:
                // Build authorize URL and redirect user to Twitter.
                $url = $connection->getAuthorizeURL($token);
                require_once 'store.phtml';
                break;
            default:
                throw new Exception('Could not connect to Tumblr (' . $connection->http_code . ').');
        }
    } else {
        // Create a TumblrOAuth object with consumer/user tokens.
        $accessToken = $_SESSION['access_token'];
        $connection  = new TumblrOAuth(CONSUMER_KEY, CONSUMER_SECRET, $accessToken['oauth_token'], $accessToken['oauth_token_secret']);

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        // If method is set change API call made. Test is called by default.
        $content = $connection->post('api/authenticate');

        if (!$content) {
            throw new Exception('Cannot connect to api/authenticate.');
        }

        if (!isset($content->tumblelog) || !isset($content->tumblelog[0])) {
            throw new Exception('Invalid response from api/authenticate.');
        }

        $tumblr = (array) $content->tumblelog[0];
        $tumblr = $tumblr['@attributes'];

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        if (!isset($tumblr['name'])) {            
            throw new Exception('Invalid or non-existant Tumblr name!');
        }

        if (isset($tumblr['avatar-url'])) {
            // Switch from 128 to 16 pixel avatars
            $tumblr['avatar'] = substr($tumblr['avatar-url'], 0, -7) . '16' . substr($tumblr['avatar-url'], -4);
        } else {
            logError('Non existent avatar URL.');
            $tumblr['avatar'] = 'img/space.png';
        }

        $tumblr['title'] = isset($tumblr['title']) ? $tumblr['title'] : $tumblr['name'];
        $tumblr['url']   = isset($tumblr['url'])   ? $tumblr['url']   : 'http://tumblr.com/';

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

        $fp = fsockopen('unix://../unix.socket', 0, $errNo, $errStr, 30);
        if (!$fp) {
            throw new Exception('Cannot establish socket credentials. ' . $errStr . '.');
        }

        $jsonCreds = json_encode(array(
            'key'  => $accessToken['oauth_token'],
            'user' => array(
                'name'      => $tumblr['name'],
                'title'     => $tumblr['title'],
                'url'       => $tumblr['url'],
                'avatar'    => $tumblr['avatar'])));
        
        $result = fwrite($fp, $jsonCreds);

        if (!$result) {
            throw new Exception('Cannot write socket credentials.');
        }

        // Load HTML
        require_once 'index.phtml';
        session_unset();
    }
} catch (Exception $e) {
    logError($e->getMessage(), true);
}

function logError($message, $die = false) {
    error_log($message . "\n", 3, '../phperr.out');
    if ($die) {
        require_once 'error.phtml';
    }
}