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

# Copy config.js.bu and replace all of the open variables with user input
sed -e "s/CHATLR_DOMAIN/$1/" -e "s/TUMBLR_CONSUMER_KEY/$2/" -e "s/TUMBLR_CONSUMER_SECRET/$3/" -e "s/TUMBLR_USERNAME/$4/" -e "s/SESSION_SECRET/$5/" config.js.bu >> config.js

# Run the Chatlr script and output errors to out.log
forever start chatlr.js
