import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'fs';
import { join } from 'path';

export function configureApp(app: NestExpressApplication) {
  app.enableCors();
  const publicRoot = resolvePublicRoot();
  const publicIndexFile = join(publicRoot, 'index.html');
  const hasPublicIndexFile = existsSync(publicIndexFile);

  if (!hasPublicIndexFile) {
    console.warn(`[Static] index.html not found at ${publicIndexFile}`);
  }

  app.useStaticAssets(publicRoot, { index: 'index.html' });
  if (hasPublicIndexFile) {
    app.getHttpAdapter().get('/', (_req, res: any) => {
      res.sendFile(publicIndexFile);
    });
  }

  const config = new DocumentBuilder()
    .setTitle('Skin Care')
    .setDescription('Skin Care - Know what you need for your skin')
    .setVersion('1.0')
    .addTag('Skin Care')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token here...',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}

export function resolvePort(app: NestExpressApplication): number {
  const configService: ConfigService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 3000);
  return Number.isNaN(port) ? 3000 : port;
}

function resolvePublicRoot(): string {
  const candidates = [
    join(process.cwd(), 'public'),
    join(__dirname, '..', 'public'),
    join(__dirname, 'public'),
    join(process.cwd(), '..', 'public'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return candidates[0];
}
