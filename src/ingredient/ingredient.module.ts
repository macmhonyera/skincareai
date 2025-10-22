import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredient.controller';
import { TypeOrmModule } from 'src/database/typeorm-ex.module';
import { IngredientRepository } from './ingredient.repository';
import { IngredientsService } from './ingredient.service';

@Module({
  imports: [TypeOrmModule.forCustomRepository([IngredientRepository])],
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientModule {}
