import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IngredientRepository } from './ingredient.repository';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(IngredientRepository)
    private readonly ingredientRepository: IngredientRepository,
  ) {}

  findAll(): Promise<Ingredient[]> {
    return this.ingredientRepository.find();
  }

  findByName(name: string): Promise<Ingredient | null> {
    return this.ingredientRepository.findOne({ where: { name } });
  }

  create(ingredient: Partial<Ingredient>): Promise<Ingredient> {
    const newIngredient = this.ingredientRepository.create(ingredient);
    return this.ingredientRepository.save(newIngredient);
  }
}
