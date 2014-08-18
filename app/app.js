var express          = require('express.io'),
    app              = express(),
    routes           = require('./routes'),
    confOauth        = require('../config/oauth'),
    passport         = require('passport'),
    mongojs          = require('mongojs'),

    StrategyTumblr   = require('passport-tumblr').Strategy,
    Database         = db = mongojs.connect(process.env.MONGO_URL || null);

app.http().io();

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

passport.use(new StrategyTumblr(
    confOauth.tumblr,
    function (accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
            return done(null, profile);
        });
    }
));

app.configure(function () {
    app.set('views', __dirname + '/views');
    app.engine('html', require('ejs').renderFile);
    app.use(express.logger());
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.session({ secret: 'chatlrbingbong' }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.static(__dirname + '/../public'));
});

// Attach IO routes for chatting
app.io.route('ready', function(req) {
    req.io.emit('talk', {
        message: 'io event from an io route on the server'
    })
});

//app.io.route('chat', require('./ioroutes'));

app.get('/',
    passport.authenticate('tumblr'),
    function (req, res) {
        // Silence
    }
);

app.get('/account', ensureAuthenticated, function (req, res) {
    res.render('chat.html', { user: req.user || 'Offline' });
});

app.get('/auth/tumblr/callback',
    passport.authenticate('tumblr', { failureRedirect: '/' }),
    function (req, res) {
        res.redirect('/account');
    }
);

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

// Setup the ready route, and emit talk event.
app.io.route('ready', function(req) {
    console.log(req.session.passport);
    req.io.emit('welcome', {
        message: 'Welcome to the game, ' + req.session.passport.user.username
    })
});

// port
app.listen(process.env.PORT || 8080);

// test authentication
function ensureAuthenticated(req, res, next) {
    return next();

    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect('/');
    return null;
}