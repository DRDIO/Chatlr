Introduction
------------

Chatlr is a realtime chat powered by node.js, socket.io, and connect with Tumblr OAuth verification.

Legal License
-------------

[Chatlr](http://chatlr.com/) by [DRD.IO](http://drd.io) is licensed under a 
[Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License](http://creativecommons.org/licenses/by-nc-sa/3.0/)
based on work provided in this repository, not including the submodules. You are free to share and remix this code,
though you must provide attribution and may not use it commercially.

Installation
------------

The following is an example of how to install Chatlr from scratch on Ubuntu 11.04 (as root).

	# Get the essentials
	apt-get update
	apt-get install git-core build-essential libssl-dev

	# Install node.js
	cd /usr/src
	git clone https://github.com/joyent/node
	cd node
	./configure
	make
	make install

	# install Chatlr
	cd /usr/src
	git clone git://github.com/KevinNuut/Chatlr.git

	# Setup Chatlr
	cd Chatlr
	git submodule update --init --recursive
	cp config/config.js.bu config/config.js

	# Open config/config.js and set up the custom fields
	# Replace anything in all caps

	# Run the Chatlr script and output errors to out.log
	node chatlr.js > out.log &

Alternatively, you can use the forever package by running the additional commands.

	# Install NPM (Node Package Manager)
	curl http://npmjs.org/install.sh | sudo sh

	# Install Forever
	npm install forever

	# Run Node.JS as a forever script
	cd /usr/src/Chatlr
	forever start chatlr.js

An example script can be found in `install.sh`. This is great for getting Chatlr quickly running on Cloud or VPS instance.

	
	# Run this command from your local computer into your clean remote Ubuntu box
	ssh root@IP_ADDRESS 'bash -s CHATLR_DOMAIN TUMBLR_CONSUMER_KEY TUMBLR_CONSUMER_SECRET TUMBLR_USERNAME SESSION_SECRET' < install.sh

Note that there are other config options available in `config.js`, like changing the default IP address, port, and OAuth service.
