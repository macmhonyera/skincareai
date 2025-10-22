import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { IngredientsService } from './ingredient.service';
import { Ingredient } from './entities/ingredient.entity';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  findAll(): Promise<Ingredient[]> {
    return this.ingredientsService.findAll();
  }

  @Get(':name')
  findByName(@Param('name') name: string): Promise<Ingredient | null> {
    return this.ingredientsService.findByName(name);
  }

  @Post()
  create(@Body() ingredient: Partial<Ingredient>): Promise<Ingredient> {
    return this.ingredientsService.create(ingredient);
  }
}
