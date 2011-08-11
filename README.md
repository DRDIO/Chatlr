Chatlr README
=============

Introduction
------------

Chatlr is a web chat powered by node.js, socket.io, connect, and oauth verified users.

Installation
------------

The following is an example of how to install Chatlr from scratch on Ubuntu 11.04 (as root).

	apt-get update
	apt-get install git-core build-essential libssl-dev
	cd /usr/src
	git clone https://github.com/joyent/node
	cd node
	./configure
	make
	make install

	cd /usr/src
	git clone git://github.com/KevinNuut/Chatlr.git
	cd Chatlr
	git submodule update --init --recursive

	node node/index.js > out.log &
