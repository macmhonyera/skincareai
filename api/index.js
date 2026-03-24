const path = require('path');
const fs = require('fs');

// Debug: check if dist files exist
const distPath = path.join(__dirname, '..', 'dist', 'src', 'app.module.js');
const distExists = fs.existsSync(distPath);

let NestFactory, AppModule, ExpressAdapter, express, configureApp;
let loadError = null;

try {
  NestFactory = require('@nestjs/core').NestFactory;
  AppModule = require('../dist/src/app.module').AppModule;
  ExpressAdapter = require('@nestjs/platform-express').ExpressAdapter;
  express = require('express');
  configureApp = require('../dist/src/app.setup').configureApp;
} catch (err) {
  loadError = err;
}

const server = express ? express() : null;
let appPromise = null;

async function createServer() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
      );

      configureApp(app);
      await app.init();

      return app;
    })();
  }

  return appPromise;
}

module.exports = async function handler(req, res) {
  if (loadError) {
    console.error('Module load error:', loadError);
    return res.status(500).json({
      error: 'Module load failed',
      message: loadError.message,
      distExists,
      distPath,
      cwd: process.cwd(),
      dirname: __dirname,
    });
  }

  try {
    await createServer();
    return server(req, res);
  } catch (error) {
    console.error('Function init failed:', error);
    return res.status(500).json({
      error: 'Function initialization failed',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};
