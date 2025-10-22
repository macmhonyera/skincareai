/* eslint-disable @typescript-eslint/require-await */
import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class MarketplaceService {
  async searchProductsByIngredient(ingredients: string[]): Promise<any[]> {
    try {
      const tag = process.env.AMAZON_ASSOCIATE_TAG ?? 'macmie-20';

      const products = ingredients.map((ingredient) => {
        const encoded = encodeURIComponent(ingredient);
        const amazonSearchUrl = `https://www.amazon.com/s?k=${encoded}&i=beauty-intl-ship&tag=${tag}`;

        return {
          title: `Shop ${ingredient} skincare on Amazon`,
          image: `https://via.placeholder.com/150x150?text=${encoded}`,
          price: '—',
          link: amazonSearchUrl,
        };
      });

      return products;
    } catch (error) {
      console.error('Marketplace search error:', error);
      throw new InternalServerErrorException(
        'Failed to generate marketplace links',
      );
    }
  }
}
