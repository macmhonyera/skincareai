import { CustomRepository } from 'src/database/typeorm-ex.decorator';
import { Repository } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';

@CustomRepository(Ingredient)
export class IngredientRepository extends Repository<Ingredient> {}
