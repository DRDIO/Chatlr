# Chatlr Install Script for Ubuntu

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

# Install NPM (Node Package Manager)
curl http://npmjs.org/install.sh | sudo sh

# Install Forever
npm install forever

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
# cd /usr/src/Chatlr
# forever start chatlr.js
