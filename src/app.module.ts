/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { IngredientModule } from './ingredient/ingredient.module';
import { ProductsModule } from './products/products.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AiModule } from './ai/ai.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      // eslint-disable-next-line @typescript-eslint/require-await
      useFactory: async (configService: ConfigService) => {
        return {
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          username: configService.get('DB_USER'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
          entities: [join(__dirname, '**', '*.entity.{js,ts}')],
          autoLoadEntities: true,
          synchronize: true, // Set to false in production
          logging: true, // Enable logging for debugging
        };
      },
    }),
    UserModule,
    IngredientModule,
    ProductsModule,
    RecommendationsModule,
    AiModule,
    MarketplaceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
