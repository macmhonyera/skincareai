import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get('search')
  findByIngredients(
    @Query('ingredients') ingredients: string,
  ): Promise<Product[]> {
    if (!ingredients) {
      return Promise.resolve([]);
    }

    const ingredientList = ingredients.split(',').map((i) => i.trim());
    return this.productsService.findByIngredients(ingredientList);
  }

  @Post()
  create(@Body() product: CreateProductDto): Promise<Product> {
    return this.productsService.create(product);
  }
}
