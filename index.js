'use strict';

const hof = require('hof');
const app = require('express')();
const churchill = require('churchill');
const path = require('path');
const router = require('./lib/router');
const serveStatic = require('./lib/serve-static');
const sessionStore = require('./lib/sessions');
const settings = require('./lib/settings');
const defaults = require('./lib/defaults');

const getConfig = function (options) {
  const args = [].slice.call(arguments);
  return Object.assign.apply(null, [{}, defaults].concat(args));

}

module.exports = options => {

  const load = (config) => {
    config.routes.forEach((route) => {
      const routeConfig = Object.assign({}, {route}, config)
      app.use(router(routeConfig));
    });
  };

  const bootstrap = {

    use: middleware => {
      app.use(middleware);
    },

    start: config => {
      return new Promise((resolve, reject) => {
        if (config.start === false) {
          return resolve(bootstrap);
        }
        if (!config.protocol) {
          config = getConfig(options, config);
        }
        bootstrap.server = require(config.protocol).createServer(app);
        try {
          bootstrap.server.listen(config.port, config.host, () => {
            resolve(bootstrap);
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    stop: () => {
      bootstrap.server.close();
    }

  };

  const config = getConfig(options);

  const i18n = require('hof').i18n({
    path: path.resolve(config.caller, config.translations) + '/__lng__/__ns__.json'
  });

  if (!config || !config.routes || !config.routes.length) {
    throw new Error('Must be called with a list of routes');
  }

  config.routes.forEach(route => {
    if (!route.steps) {
      throw new Error('Each route must define a set of one or more steps');
    }
  });

  if (config.env !== 'test' && config.env !== 'ci') {
    config.logger = require('./lib/logger')(config);
    bootstrap.use(churchill(config.logger));
  }

  serveStatic(app, config);
  settings(app, config);
  sessionStore(app, config)

  load(config);

  if (config.getCookies === true) {
    app.get('/cookies', (req, res) => res.render('cookies'));
  }

  if (config.getTerms === true) {
    app.get('/terms-and-conditions', (req, res) => res.render('terms'));
  }

  bootstrap.use(require('hof').middleware.errors({
    translate: i18n.translate.bind(i18n),
    debug: process.env.NODE_ENV === 'development'
  }));

  return bootstrap.start(config);

};