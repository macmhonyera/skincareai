import { Controller, Get, Query } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('products')
  async getProducts(@Query('ingredients') ingredients: string | string[]) {
    const ingredientList = Array.isArray(ingredients)
      ? ingredients
      : ingredients.split(',').map((i) => i.trim());
    return this.marketplaceService.searchProductsByIngredient(ingredientList);
  }
}
