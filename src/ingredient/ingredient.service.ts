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

  findByNames(names: string[]): Promise<Ingredient[]> {
    const normalized = Array.from(
      new Set(
        (names ?? [])
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0),
      ),
    );

    if (normalized.length === 0) {
      return Promise.resolve([]);
    }

    return this.ingredientRepository
      .createQueryBuilder('ingredient')
      .where('LOWER(ingredient.name) IN (:...names)', { names: normalized })
      .getMany();
  }

  create(ingredient: Partial<Ingredient>): Promise<Ingredient> {
    const newIngredient = this.ingredientRepository.create(ingredient);
    return this.ingredientRepository.save(newIngredient);
  }
}
