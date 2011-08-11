Chatlr README
=============

Introduction
------------

Chatlr is a web chat powered by node.js, socket.io, connect, and oauth verified users.

Installation
------------

The following is an example of how to install Chatlr from scratch on Ubuntu 11.04.

		apt-get update
		apt-get install git-core build-essential libssl-dev
		cd /usr/src
		git clone https://github.com/joyent/node
		cd node
		./configure
		make
		make install
		curl http://npmjs.org/install.sh | sh
		npm install forever connect socket.io
		cd /usr/src
		git clone git://github.com/KevinNuut/Chatlr.git
		cd Chatlr		
		node run.js
