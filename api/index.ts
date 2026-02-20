import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Request, Response } from 'express';

let cachedApp: any;

async function createServer() {
  const server = express();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();

  return server;
}

export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    cachedApp = await createServer();
  }

  return cachedApp(req, res);
}