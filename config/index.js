
const appURL = process.env.APP_URL || 'https://staging-2.quantnet-ai.ru';
const forumURL = appURL + "/community";

module.exports = {
	appURL: appURL,
	forumURL: forumURL,
	logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
};
