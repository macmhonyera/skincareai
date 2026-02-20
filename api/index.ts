import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const server = express();
let appPromise: Promise<NestExpressApplication> | null = null;

async function bootstrapServerlessApp(): Promise<NestExpressApplication> {
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

export default async function handler(req: any, res: any) {
  await bootstrapServerlessApp();
  return server(req, res);
}
