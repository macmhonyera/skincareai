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
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ...(process.env.VERCEL
      ? []
      : [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
          }),
        ]),

    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        const dbSsl =
          databaseUrl?.includes('sslmode=require') ||
          String(configService.get<string>('DB_SSL') ?? '').toLowerCase() ===
            'true';

        const commonOptions = {
          type: 'postgres' as const,

          ssl: dbSsl ? { rejectUnauthorized: false } : undefined,

          entities: [join(__dirname, '**', '*.entity.{js,ts}')],
          autoLoadEntities: true,

          synchronize:
            String(configService.get<string>('TYPEORM_SYNCHRONIZE') ?? 'true')
              .toLowerCase() === 'true',

          logging:
            String(configService.get<string>('TYPEORM_LOGGING') ?? 'false')
              .toLowerCase() === 'true',
        };

        if (databaseUrl) {
          return {
            ...commonOptions,
            url: databaseUrl,
          };
        }

        return {
          ...commonOptions,
          host: configService.get<string>('DB_HOST') ?? 'localhost',
          port: Number(configService.get<string>('DB_PORT') ?? 5432),
          username: configService.get<string>('DB_USER') ?? 'postgres',
          password: configService.get<string>('DB_PASSWORD') ?? '',
          database: configService.get<string>('DB_NAME') ?? 'skincare_ai',
        };
      },
    }),

    UserModule,
    IngredientModule,
    ProductsModule,
    RecommendationsModule,
    AiModule,
    MarketplaceModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}