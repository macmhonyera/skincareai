import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ProductsModule } from 'src/products/products.module';
import { AiModule } from 'src/ai/ai.module';
import { IngredientModule } from 'src/ingredient/ingredient.module';
import { MarketplaceModule } from 'src/marketplace/marketplace.module';

@Module({
  imports: [ProductsModule, AiModule, IngredientModule, MarketplaceModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
