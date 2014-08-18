module.exports = {
    tumblr: {
        consumerKey: process.env.OAUTH_CLIENT_TUMBLR,
        consumerSecret: process.env.OAUTH_SECRET_TUMBLR,
        callbackURL: process.env.OAUTH_URL + 'auth/tumblr/callback'
    }
};