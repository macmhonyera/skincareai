import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';

export function configureApp(app: NestExpressApplication) {
  app.enableCors();
  app.useStaticAssets(join(process.cwd(), 'public'));

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
