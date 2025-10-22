/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
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
  await app.listen(configService.get('PORT', '0.0.0.0'));
  console.log('Application running on port: ' + configService.get('PORT'));
}
bootstrap();
