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
        const dbHost = configService.get<string>('DB_HOST') ?? 'localhost';
        const dbSslRaw = String(configService.get<string>('DB_SSL') ?? '')
          .trim()
          .toLowerCase();

        const dbSslFromEnv =
          dbSslRaw === 'true' || dbSslRaw === '1'
            ? true
            : dbSslRaw === 'false' || dbSslRaw === '0'
              ? false
              : null;

        let dbSslFromUrl = false;
        let dbHostFromUrl: string | null = null;
        if (databaseUrl) {
          try {
            const parsed = new URL(databaseUrl);
            dbHostFromUrl = parsed.hostname;

            const sslMode =
              parsed.searchParams.get('sslmode')?.toLowerCase() ?? null;
            const sslParam =
              parsed.searchParams.get('ssl')?.toLowerCase() ?? null;

            if (sslMode && sslMode !== 'disable') {
              dbSslFromUrl = true;
            }
            if (sslParam === 'true' || sslParam === '1') {
              dbSslFromUrl = true;
            }
          } catch {
            dbSslFromUrl = databaseUrl.includes('sslmode=require');
          }
        }

        const resolvedDbHost = dbHostFromUrl ?? dbHost;
        const isLocalDbHost =
          resolvedDbHost === 'localhost' || resolvedDbHost === '127.0.0.1';
        const runningOnVercel = Boolean(process.env.VERCEL);

        const dbSsl =
          dbSslFromEnv ??
          (dbSslFromUrl || (runningOnVercel && !isLocalDbHost));

        const commonOptions = {
          type: 'postgres' as const,
          ...(dbSsl
            ? {
                ssl: { rejectUnauthorized: false },
                extra: { ssl: { rejectUnauthorized: false } },
              }
            : {}),

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
