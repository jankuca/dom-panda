## Installation ##

    git clone git://github.com/jankuca/dom-panda.git
    cd dom-panda
    git submodule update --init
    node server.js -p 1100

## Run ##

    http://localhost:1100/example/kittens.html
    http://localhost:1100/example/lastfm.html

## Do I need Node.js to run this? ##

Absolutely not! You can use whatever server you want.

The only thing you need to assure is that `/imageproxy?url=http://...` returns the image specified by the `url` GET parameter.

This is required because of the cross-origin request policy implemented by browsers. If we directly requested the image from the original location, we would get a SECURITY_ERR exception.

For example, in PHP, the image proxy script could be as simple as

    <?php
    echo file_get_contents($_GET['url']);
    ?>
