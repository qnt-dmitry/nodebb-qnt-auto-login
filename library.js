const async = require('async');

const User = require('../../src/user');
const authenticationController = module.parent.require('../../src/controllers/authentication');
const groups = module.parent.require('../../src/groups');
const controllerIndex = module.parent.require('../../src/controllers');

exports.load = function load(params, callback) {

  async.series([
    (done) => require('./lib/auto-login')({User: User, authenticationController: authenticationController, groups: groups}, params, done)
  ], callback);

};

exports.extendConfig = function extendConfig(config, callback) {

  require('./lib/extend-config')(config, callback);

};