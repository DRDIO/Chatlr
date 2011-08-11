Chatlr README
=============

Introduction
------------

Chatlr is a web chat powered by node.js, socket.io, connect, and oauth verified users.

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

An example script can be found in `install.sh`.
