const request = require('superagent');

const { appURL } = require('../../config');
const { getLogger } = require('../../logger');

const logger = getLogger('qnt/user');

exports.getSessionUser = function getSessionUser(session, callback) {

  logger.info({ method: 'getSessionUser', input: session.cookie, type: 'start' });

  if(!session.cookie || session.cookie.indexOf('access_token=') < 0) {
    logger.error({ method: 'getSessionUser', input: session.cookie,
        error: {"message":"no access token"}, type: 'end' });
    return callback({"message":"no access token"});
  }

  let access_token = session.cookie.split('access_token=')[1].split(';')[0];

  request.get(appURL + '/auth/account/me').set('Authorization', "Bearer " + access_token).end((error, res) => {

    if (error) {
      let result = JSON.parse(res.text);
      logger.error({ method: 'getSessionUser', input: session.cookie, error: result, type: 'end' });
      return callback(result);
    }

    let result = JSON.parse(res.text);
    
    logger.info({ method: 'getSessionUser', input: session.cookie, output: result, type: 'end' });

    callback(null, result);

  });

};
