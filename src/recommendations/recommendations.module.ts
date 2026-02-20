import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ProductsModule } from '../products/products.module';
import { AiModule } from '../ai/ai.module';
import { IngredientModule } from '../ingredient/ingredient.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recommendation } from './entities/recommendation.entity';
import { AuthModule } from '../auth/auth.module';

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
