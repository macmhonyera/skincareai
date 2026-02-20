/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  const configService: ConfigService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 3000);
  await app.listen(Number.isNaN(port) ? 3000 : port);
  console.log(
    'Application running on port: ' + (Number.isNaN(port) ? 3000 : port),
  );
}
bootstrap();
