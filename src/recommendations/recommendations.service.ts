/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { RecommendDto } from './dto/create-recommendation.dto';
import { MistralService } from 'src/ai/mistral.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly mistralService: MistralService,
    private readonly productsService: ProductsService,
  ) {}

  async getRecommendations(dto: RecommendDto) {
    const aiResponse = await this.mistralService.getIngredientAdvice(
      dto.skinType,
      dto.skinConcerns,
    );
    const cleaned = aiResponse
      .replace(/```json/i, '') // remove opening code block
      .replace(/```/g, '') // remove closing block
      .trim();

    let ingredientList: string[];

    try {
      ingredientList = JSON.parse(cleaned);
    } catch (error) {
      console.error('❌ Still failed to parse AI JSON:', cleaned);
      throw new InternalServerErrorException(
        'AI returned invalid JSON format.',
      );
    }

    const products =
      await this.productsService.findByIngredients(ingredientList);

    return {
      recommendedIngredients: ingredientList,
      matchingProducts: products,
    };
  }
}
