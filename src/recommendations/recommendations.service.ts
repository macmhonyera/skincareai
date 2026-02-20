import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { RecommendDto } from './dto/create-recommendation.dto';
import { MistralService } from 'src/ai/mistral.service';
import { Ingredient } from 'src/ingredient/entities/ingredient.entity';
import { IngredientsService } from 'src/ingredient/ingredient.service';
import { MarketplaceService } from 'src/marketplace/marketplace.service';
import { Product } from 'src/products/entities/product.entity';

type RankedProduct = Product & {
  matchScore: number;
  matchedIngredients: string[];
};

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  private readonly skinTypeMap: Record<string, string[]> = {
    dry: ['hyaluronic acid', 'ceramides', 'glycerin', 'squalane', 'panthenol'],
    oily: ['salicylic acid', 'niacinamide', 'zinc pca', 'green tea extract'],
    combination: ['niacinamide', 'hyaluronic acid', 'azelaic acid', 'squalane'],
    sensitive: [
      'centella asiatica',
      'colloidal oatmeal',
      'panthenol',
      'allantoin',
    ],
    normal: ['niacinamide', 'vitamin c', 'peptides', 'hyaluronic acid'],
  };

  private readonly concernMap: Record<string, string[]> = {
    acne: ['salicylic acid', 'azelaic acid', 'niacinamide', 'zinc pca'],
    breakouts: ['salicylic acid', 'benzoyl peroxide', 'niacinamide'],
    redness: ['azelaic acid', 'centella asiatica', 'allantoin'],
    sensitivity: ['panthenol', 'ceramides', 'colloidal oatmeal'],
    dehydration: ['hyaluronic acid', 'glycerin', 'urea'],
    dullness: ['vitamin c', 'niacinamide', 'lactic acid'],
    hyperpigmentation: ['tranexamic acid', 'alpha arbutin', 'vitamin c'],
    melasma: ['tranexamic acid', 'azelaic acid', 'alpha arbutin'],
    aging: ['retinol', 'peptides', 'bakuchiol', 'vitamin c'],
    wrinkles: ['retinol', 'peptides', 'bakuchiol'],
    pores: ['niacinamide', 'salicylic acid', 'retinol'],
    texture: ['lactic acid', 'glycolic acid', 'retinol'],
    darkspots: ['alpha arbutin', 'tranexamic acid', 'niacinamide'],
    dark_spots: ['alpha arbutin', 'tranexamic acid', 'niacinamide'],
    darkspotsandmarks: ['alpha arbutin', 'tranexamic acid', 'vitamin c'],
  };

  private readonly sensitivityAvoidMap: Record<string, string[]> = {
    fragrance: ['fragrance', 'essential oil'],
    perfumes: ['fragrance', 'essential oil'],
    rosacea: ['retinol', 'glycolic acid', 'benzoyl peroxide'],
    eczema: ['glycolic acid', 'retinol', 'benzoyl peroxide'],
    pregnancy: ['retinol', 'retinoid', 'hydroquinone'],
    pregnant: ['retinol', 'retinoid', 'hydroquinone'],
  };

  constructor(
    private readonly mistralService: MistralService,
    private readonly productsService: ProductsService,
    private readonly ingredientsService: IngredientsService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  async getRecommendations(dto: RecommendDto) {
    const skinType = this.normalizeValue(dto.skinType) || 'normal';
    const concerns = this.normalizeUnknownList(dto.skinConcerns);
    const sensitivities = this.normalizeUnknownList(dto.sensitivities ?? []);

    const ruleBasedIngredients = this.buildRuleBasedIngredients(
      skinType,
      concerns,
      sensitivities,
    );
    const aiIngredients = await this.getAiIngredients({
      skinType,
      concerns,
      sensitivities,
      routineGoal: dto.routineGoal,
      budgetLevel: dto.budgetLevel,
    });

    const recommendedIngredients = this.limitIngredients(
      [...aiIngredients, ...ruleBasedIngredients],
      10,
    );

    const products =
      await this.productsService.findByIngredients(recommendedIngredients);
    const rankedProducts = this.rankProducts(products, recommendedIngredients);
    const ingredientInfo = await this.ingredientsService.findByNames(
      recommendedIngredients,
    );
    const ingredientInsights = this.buildIngredientInsights(
      recommendedIngredients,
      ingredientInfo,
      concerns,
    );

    const marketplaceLinks =
      rankedProducts.length < 3
        ? await this.marketplaceService.searchProductsByIngredient(
            recommendedIngredients.slice(0, 5),
          )
        : [];

    return {
      profile: {
        skinType,
        skinConcerns: concerns,
        sensitivities,
        routineGoal: dto.routineGoal ?? null,
        budgetLevel: dto.budgetLevel ?? null,
      },
      recommendedIngredients,
      ingredientInsights,
      matchingProducts: rankedProducts,
      marketplaceLinks,
      routine: this.buildRoutine(recommendedIngredients, concerns),
      meta: {
        source: aiIngredients.length > 0 ? 'ai+rules' : 'rules-only',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private async getAiIngredients(profile: {
    skinType: string;
    concerns: string[];
    sensitivities: string[];
    routineGoal?: string;
    budgetLevel?: string;
  }): Promise<string[]> {
    try {
      const aiResponse = await this.mistralService.getIngredientAdvice(profile);
      return this.parseAiIngredients(aiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AI recommendation unavailable, using rule-based fallback: ${message}`,
      );
      return [];
    }
  }

  private parseAiIngredients(raw: string): string[] {
    const cleaned = (raw ?? '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    if (!cleaned) {
      return [];
    }

    const candidates = [cleaned];
    const startIndex = cleaned.indexOf('[');
    const endIndex = cleaned.lastIndexOf(']');

    if (startIndex !== -1 && endIndex > startIndex) {
      candidates.push(cleaned.slice(startIndex, endIndex + 1));
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as unknown;

        if (Array.isArray(parsed)) {
          const normalized = this.normalizeList(
            parsed
              .map((item) => (typeof item === 'string' ? item : ''))
              .filter((item) => item.length > 0),
          );

          if (normalized.length > 0) {
            return normalized;
          }
        }

        if (
          parsed &&
          typeof parsed === 'object' &&
          'ingredients' in parsed &&
          Array.isArray((parsed as { ingredients: unknown[] }).ingredients)
        ) {
          const normalized = this.normalizeList(
            (parsed as { ingredients: unknown[] }).ingredients
              .map((item) => (typeof item === 'string' ? item : ''))
              .filter((item) => item.length > 0),
          );

          if (normalized.length > 0) {
            return normalized;
          }
        }
      } catch {
        continue;
      }
    }

    const quoted = cleaned.match(/"([^"]+)"/g);
    if (quoted) {
      const fromQuotes = this.normalizeList(
        quoted.map((value) => value.replace(/"/g, '')),
      );
      if (fromQuotes.length > 0) {
        return fromQuotes;
      }
    }

    const splitFallback = this.normalizeList(
      cleaned
        .split(/[\n,]/)
        .map((item) => item.replace(/^[\-\d\.\)\s]+/, '')),
    );
    return splitFallback;
  }

  private buildRuleBasedIngredients(
    skinType: string,
    concerns: string[],
    sensitivities: string[],
  ): string[] {
    const baseIngredients = this.skinTypeMap[skinType] ?? this.skinTypeMap.normal;
    const concernIngredients = concerns.flatMap((concern) => {
      const normalizedConcern = concern.replace(/\s+/g, '');
      return this.concernMap[concern] ?? this.concernMap[normalizedConcern] ?? [];
    });
    const avoidList = new Set(
      sensitivities.flatMap((entry) => this.sensitivityAvoidMap[entry] ?? []),
    );

    return this.normalizeList([...baseIngredients, ...concernIngredients]).filter(
      (ingredient) => !avoidList.has(ingredient),
    );
  }

  private rankProducts(
    products: Product[],
    recommendedIngredients: string[],
  ): RankedProduct[] {
    const recommendationSet = new Set(recommendedIngredients);

    return products
      .map((product) => {
        const matchedIngredients = this.normalizeList(product.ingredients).filter(
          (ingredient) => recommendationSet.has(ingredient),
        );

        const score =
          recommendedIngredients.length === 0
            ? 0
            : Math.round(
                (matchedIngredients.length / recommendedIngredients.length) * 100,
              );

        return {
          ...product,
          matchScore: score,
          matchedIngredients,
        };
      })
      .sort(
        (a, b) =>
          b.matchScore - a.matchScore || a.name.localeCompare(b.name, 'en'),
      );
  }

  private buildIngredientInsights(
    ingredients: string[],
    knownIngredients: Ingredient[],
    concerns: string[],
  ) {
    const byName = new Map(
      knownIngredients.map((ingredient) => [
        ingredient.name.trim().toLowerCase(),
        ingredient,
      ]),
    );

    return ingredients.map((ingredient) => {
      const fromDatabase = byName.get(ingredient);
      return {
        name: ingredient,
        description:
          fromDatabase?.description ??
          this.inferReasonFromConcern(ingredient, concerns),
        benefits: fromDatabase?.benefits ?? [],
      };
    });
  }

  private inferReasonFromConcern(ingredient: string, concerns: string[]): string {
    const concernText = concerns.join(', ');

    if (ingredient.includes('salicylic') || ingredient.includes('benzoyl')) {
      return `Supports clearer-looking skin for concerns like ${concernText || 'breakouts'}.`;
    }

    if (ingredient.includes('hyaluronic') || ingredient.includes('glycerin')) {
      return 'Helps improve hydration and supports a stronger moisture barrier.';
    }

    if (ingredient.includes('retinol') || ingredient.includes('peptides')) {
      return 'Supports smoother texture and visible anti-aging benefits over time.';
    }

    if (
      ingredient.includes('tranexamic') ||
      ingredient.includes('arbutin') ||
      ingredient.includes('vitamin c')
    ) {
      return 'Targets uneven tone and helps brighten dull-looking skin.';
    }

    if (
      ingredient.includes('centella') ||
      ingredient.includes('allantoin') ||
      ingredient.includes('panthenol')
    ) {
      return 'Helps calm visible redness and reduce irritation-prone discomfort.';
    }

    return 'Selected to align with your skin profile and stated concerns.';
  }

  private buildRoutine(ingredients: string[], concerns: string[]) {
    const morningFocus = this.pickPreferredIngredients(ingredients, [
      'vitamin c',
      'niacinamide',
      'hyaluronic acid',
      'azelaic acid',
    ]);
    const eveningFocus = this.pickPreferredIngredients(ingredients, [
      'retinol',
      'salicylic acid',
      'peptides',
      'tranexamic acid',
      'ceramides',
    ]);

    const cautionList: string[] = [];
    if (ingredients.includes('retinol') && ingredients.includes('salicylic acid')) {
      cautionList.push(
        'Alternate retinol and salicylic acid at night to reduce irritation.',
      );
    }
    if (concerns.includes('sensitivity') || concerns.includes('redness')) {
      cautionList.push(
        'Patch test new actives and prioritize soothing, fragrance-free formulas.',
      );
    }

    return {
      morning: [
        'Use a gentle cleanser.',
        morningFocus
          ? `Apply a treatment with ${morningFocus}.`
          : 'Apply a lightweight antioxidant or hydrating serum.',
        'Seal with moisturizer and broad-spectrum SPF 30+.',
      ],
      evening: [
        'Double cleanse if wearing sunscreen or makeup.',
        eveningFocus
          ? `Use one active treatment featuring ${eveningFocus}.`
          : 'Use one treatment step based on your top concern.',
        'Finish with a barrier-supporting moisturizer.',
      ],
      cautions: cautionList,
    };
  }

  private pickPreferredIngredients(
    ingredients: string[],
    priority: string[],
  ): string | null {
    for (const target of priority) {
      if (ingredients.includes(target)) {
        return target;
      }
    }
    return ingredients[0] ?? null;
  }

  private limitIngredients(ingredients: string[], max: number): string[] {
    return this.normalizeList(ingredients).slice(0, max);
  }

  private normalizeUnknownList(values: string[] | string | undefined): string[] {
    if (Array.isArray(values)) {
      return this.normalizeList(values);
    }

    if (typeof values === 'string') {
      return this.normalizeList(values.split(','));
    }

    return [];
  }

  private normalizeList(values: string[]): string[] {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => this.normalizeValue(value))
          .filter((value): value is string => value.length > 0),
      ),
    );
  }

  private normalizeValue(value: string | undefined | null): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s\-+]/g, '')
      .replace(/\s+/g, ' ');
  }
}
