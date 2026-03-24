import { execSync } from 'child_process';
import { cpSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const output = join(root, '.vercel', 'output');
const funcDir = join(output, 'functions', 'api', 'index.func');

// Step 1: Build the NestJS app
console.log('Running nest build...');
execSync('npx nest build', { stdio: 'inherit', cwd: root });

// Step 2: Create the output directory structure
mkdirSync(funcDir, { recursive: true });
mkdirSync(join(output, 'static'), { recursive: true });

// Step 3: Copy static files
if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(output, 'static'), { recursive: true });
}

// Step 4: Copy dist into the function
cpSync(join(root, 'dist'), join(funcDir, 'dist'), { recursive: true });

// Step 5: Create a production-only package.json (no devDependencies)
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  dependencies: pkg.dependencies,
};
writeFileSync(join(funcDir, 'package.json'), JSON.stringify(prodPkg, null, 2));

if (existsSync(join(root, 'package-lock.json'))) {
  cpSync(join(root, 'package-lock.json'), join(funcDir, 'package-lock.json'));
}

console.log('Installing production dependencies...');
execSync('npm ci --omit=dev', { stdio: 'inherit', cwd: funcDir });

// Step 6: Remove unnecessary files to reduce size
const dirsToRemove = [
  'node_modules/@swc',
  'node_modules/typescript',
  'node_modules/ts-node',
  'node_modules/@types',
  'node_modules/swagger-ui-dist/swagger-ui.js.map',
];

for (const dir of dirsToRemove) {
  const fullPath = join(funcDir, dir);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  }
}

// Step 7: Create the function entry point
writeFileSync(
  join(funcDir, 'index.js'),
  `const path = require('path');
const fs = require('fs');

let server = null;
let appPromise = null;

async function createServer() {
  if (!appPromise) {
    appPromise = (async () => {
      const { NestFactory } = require('@nestjs/core');
      const { AppModule } = require('./dist/app.module');
      const { ExpressAdapter } = require('@nestjs/platform-express');
      const express = require('express');
      const { configureApp } = require('./dist/app.setup');

      server = express();
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
      );
      configureApp(app);
      await app.init();
      return app;
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  try {
    await createServer();
    return server(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Function initialization failed',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\\n').slice(0, 8) : undefined,
    }));
  }
};
`,
);

// Step 8: Function config
writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs20.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// Step 9: Global output config with routes
writeFileSync(
  join(output, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/api/index' },
      ],
    },
    null,
    2,
  ),
);

// Report final size
const result = execSync(`du -sh "${funcDir}"`, { encoding: 'utf-8' }).trim();
console.log(`Function size: ${result}`);
console.log('Build output assembled successfully.');
