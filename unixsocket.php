<?php

echo "\n" . 'init socket' . "\n";

var_dump(chmod('unix.socket', 0777));

$fp = fsockopen('unix://unix.socket', 0, $errNo, $errStr, 30);
if (!$fp) {
  echo $errStr . ': ' . $errNo . "\n";
} else {
  echo 'writing';
  $result = fwrite($fp, json_encode(array(
     'id'    => 'lacey', 
     'user'  => '1234', 
     'title' => 'kevinnuut')));
  echo $result . "\n";
}
