import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { ProductsModule } from 'src/products/products.module';
import { AiModule } from 'src/ai/ai.module';
import { MistralService } from 'src/ai/mistral.service';
import { ProductsService } from 'src/products/products.service';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from 'src/database/typeorm-ex.module';
import { ProductRepository } from 'src/products/products.repository';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forCustomRepository([ProductRepository]),
    ProductsModule,
    AiModule,
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, MistralService, ProductsService],
})
export class RecommendationsModule {}
