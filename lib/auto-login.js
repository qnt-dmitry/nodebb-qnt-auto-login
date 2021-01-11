const async = require('async');

const NodeBB = require.main;
const db = NodeBB.require('./src/database');
const { getSessionUser } = require('./qnt/user');
const { appURL, forumURL } = require('../config');
const { getLogger } = require('../logger');

const logger = getLogger('auto-login');

let createObjectKey = function(uid, namespace) {
  return 'user:' + uid + ':' + namespace;
};

function canSkipPath(path) {
  if(path.indexOf('/assets/') !== -1) {
    return true;
  }
  if(path === '/email_not_found') {
   return true;
  }
  return false;
}

let basePath = forumURL.split('/').slice(3).join('/');
if(basePath) {
    basePath = '/' + basePath;
}

module.exports = function setupAutoLogin(dependencies, params, callback) {

  let router = params.router;

  function autoLogin(req, res, next) {
//    if(req.path === '/login') {
//        return res.redirect(appURL + '/personalpage/login?returnTo=' + forumURL);
//    }
//
//    if(req.path === '/logout') {
//        return res.redirect(appURL + '/personalpage/logout?returnTo=' + forumURL);
//    }
//
//    if(req.path === '/register') {
//        return res.redirect(appURL + '/personalpage/registration?returnTo=' + forumURL);
//    }
    if(req.uid == 1) {
        return next();
    }

    if (!req.baseUrl && canSkipPath(req.path)) {
      return next();
    }

    async.waterfall([(done) => {
      getUser(req.headers, done);
    }, (user, done) => {
      if (req.uid) {
        return done(null, false);
      }
      doLogin(req, user, done);
    }], (error, user, loggedInNow) => {
      res.session = res.session || {};

      if (error) {

        if (error.message === 'INVALID_EMAIL' && req.path != '/email_not_found') {
          return res.redirect(forumURL + '/email_not_found');
        }

        // req.uid exists meaning, the app session is invalidated and forum session not
        if (req.uid) {
          // invalidate forum session too
          req.logout();
        }

        return next();

      }

      if (loggedInNow) {
        // Redirect first time to refresh session.
        return res.redirect(forumURL + req.path);
      }

      return next();

    });

  }

  router.use(autoLogin);

  router.get('/email_not_found', function(req, res) {
    res.render('email_not_found', { appURL: appURL });
  });

  callback();


  function getUser(headers, callback) {

    logger.info({ method: 'getUser', input: headers.cookie, type: 'start' });

    async.waterfall([function getUserFromRemote(done) {
      getSessionUser(headers, done);
    }, function findInLocal(user, done) {
      if (!user) {
        return done(new Error('Invalid Session'));
      }
      doFindOrCreateUser(user, done);
    }], (error, user) => {
      if (error) {
        logger.error({ method: 'getUser', input: headers.cookie, error: error.toString(), type: 'end' });
        return callback(error);
      }
      logger.info({ method: 'getUser', input: headers.cookie, output: user, type: 'end' });
      callback(null, user);
    });

  }

  function doCreateUser(data, callback) {

    logger.info({ method: 'doCreateUser', input: data, type: 'start' });

    return dependencies.User.create(data, (error, result) => {

      if (error) {
        logger.error({ method: 'doCreateUser', input: data, error: error.toString(), type: 'end' });
        return callback(error);
      }

      logger.info({ method: 'doCreateUser', input: data, output: result, type: 'end' });
      callback(null, result);

    });
  }

  function doFindOrCreateUser(user, callback) {

    logger.info({ method: 'doFindOrCreateUser', input: user, type: 'start' });

    if (!user.email || !user.emailConfirmed) {
      return callback(new Error('INVALID_EMAIL'), null);
    }
    const internalId = "u" + user.id;
    async.waterfall([function findUser(done) {
      dependencies.User.getUidByUsername(internalId, (error, uid) => done(error, uid ? uid : null));
    }, function findUserByEmail(uid, done){
        if(uid) {
            done(null, uid)
        } else {
            dependencies.User.getUidByEmail(user.email, (error, uid) => done(error, uid ? uid : null))
        }
    }, function tryCreateUser(uid, done) {
      if (!uid) {
        async.waterfall([(done) => doCreateUser({
          fullname: user.username,
          email: user.email,
          username: internalId
        }, done), (uid, done) => {
          if (isAdmin(user.email)) {
            return dependencies.groups.join('administrators', uid, function(err) {
              done(err, uid);
            });
          }
          done(null, uid);
        }], done);
      } else {
        dependencies.User.updateProfile(uid, {
            fullname: user.username,
            email: user.email,
            username: internalId
        }, () => done(null, uid));
      }
    }], (error, uid) => {

      if (error) {
        logger.error({ method: 'doFindOrCreateUser', input: user, error: error.toString(), type: 'end' });
        return callback(error);
      }

      user.uid = uid;

      logger.info({ method: 'doFindOrCreateUser', input: user, output: user, type: 'end' });

      callback(null, user);

    });

  }

  function doLogin(req, user, callback) {

    logger.info({ method: 'doLogin', input: user, type: 'start' });

    dependencies.authenticationController.doLogin(req, user.uid, (error) => {

      if (error) {

        logger.error({ method: 'doLogin', input: user, error: error.toString(), type: 'end' });
        return callback(error);

      }

      let loggedInNow = true;

      logger.info({ method: 'doLogin', input: user, output: {}, type: 'end' });
      callback(null, user, loggedInNow);

    });
  }

  function isAdmin(email) {
    return email && (email.endsWith('@quantnet.ai') || email.endsWith('@quantiacs.com'));
  }

};