import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ProductsModule } from 'src/products/products.module';
import { AiModule } from 'src/ai/ai.module';
import { IngredientModule } from 'src/ingredient/ingredient.module';
import { MarketplaceModule } from 'src/marketplace/marketplace.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recommendation } from './entities/recommendation.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ProductsModule,
    AiModule,
    IngredientModule,
    MarketplaceModule,
    AuthModule,
    TypeOrmModule.forFeature([Recommendation]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
