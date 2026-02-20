import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { configureApp } from '../src/app.setup';

const server = express();
let appPromise: Promise<NestExpressApplication> | null = null;

async function createServer() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await NestFactory.create<NestExpressApplication>(
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

export default async function handler(req: Request, res: Response) {
  await createServer();
  return server(req, res);
}
