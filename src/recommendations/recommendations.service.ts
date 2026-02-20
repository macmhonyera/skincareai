import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { RecommendDto } from './dto/create-recommendation.dto';
import { MistralService } from '../ai/mistral.service';
import { Ingredient } from '../ingredient/entities/ingredient.entity';
import { IngredientsService } from '../ingredient/ingredient.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { Product } from '../products/entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Recommendation } from './entities/recommendation.entity';
import { Repository } from 'typeorm';

type RankedProduct = Product & {
  matchScore: number;
  matchedIngredients: string[];
};

type RecommendationContext = {
  userId: string | null;
  planTier: 'free' | 'pro';
  source: 'form' | 'image';
};

type NormalizedProfile = {
  skinType: string;
  concerns: string[];
  sensitivities: string[];
  routineGoal?: string;
  budgetLevel?: string;
};

type ImageAnalysis = {
  suggestedSkinType: string | null;
  detectedConcerns: string[];
  observations: string[];
  confidence: number;
  concernScores: {
    acne: number;
    pigmentation: number;
    redness: number;
    texture: number;
    dehydration: number;
    oiliness: number;
  };
  overallSkinScore: number;
};

type PersistedImageAsset = {
  imageUrl: string | null;
  imageData: Buffer | null;
  imageMimeType: string | null;
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
    @InjectRepository(Recommendation)
    private readonly recommendationRepository: Repository<Recommendation>,
  ) {}

  async getRecommendations(
    dto: RecommendDto,
    context?: Partial<RecommendationContext>,
  ) {
    const profile = this.buildNormalizedProfile(dto);
    const resolvedContext: RecommendationContext = {
      userId: context?.userId ?? null,
      source: context?.source ?? 'form',
      planTier: context?.planTier ?? 'free',
    };

    return this.buildRecommendationResponse(profile, resolvedContext, null, {
      imageUrl: null,
      imageData: null,
      imageMimeType: null,
    });
  }

  async getRecommendationsWithImage(
    dto: RecommendDto,
    image: { buffer: Buffer; mimetype: string },
    context: Pick<RecommendationContext, 'userId' | 'planTier'>,
  ) {
    const providedSkinType = this.normalizeValue(dto.skinType);
    const providedConcerns = this.normalizeUnknownList(dto.skinConcerns);

    let imageAnalysis: ImageAnalysis;
    try {
      imageAnalysis = await this.mistralService.analyzeSkinImage({
        imageBase64: image.buffer.toString('base64'),
        mimeType: image.mimetype,
        notes:
          typeof dto.photoNotes === 'string'
            ? dto.photoNotes
            : 'User submitted skin image',
        skinTypeHint: providedSkinType || undefined,
        concernsHint: providedConcerns,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Image analysis failed; proceeding with profile-only logic: ${message}`,
      );

      imageAnalysis = {
        suggestedSkinType: null,
        detectedConcerns: [],
        observations: [],
        confidence: 0,
        concernScores: {
          acne: 50,
          pigmentation: 50,
          redness: 50,
          texture: 50,
          dehydration: 50,
          oiliness: 50,
        },
        overallSkinScore: 50,
      };
    }

    const mergedProfile: NormalizedProfile = {
      skinType:
        providedSkinType ||
        this.normalizeValue(imageAnalysis.suggestedSkinType) ||
        'normal',
      concerns: this.normalizeList([
        ...providedConcerns,
        ...imageAnalysis.detectedConcerns,
      ]),
      sensitivities: this.normalizeUnknownList(dto.sensitivities ?? []),
      routineGoal:
        typeof dto.routineGoal === 'string' ? dto.routineGoal.trim() : undefined,
      budgetLevel:
        typeof dto.budgetLevel === 'string'
          ? dto.budgetLevel.trim().toLowerCase()
          : undefined,
    };

    const imageAsset = this.prepareProgressImageAsset(image, context.userId);

    return this.buildRecommendationResponse(
      mergedProfile,
      { ...context, source: 'image' },
      imageAnalysis,
      imageAsset,
    );
  }

  async getProgressImage(recommendationId: string) {
    const item = await this.recommendationRepository
      .createQueryBuilder('recommendation')
      .addSelect('recommendation.imageData')
      .where('recommendation.id = :id', { id: recommendationId })
      .getOne();

    if (!item?.imageData) {
      return null;
    }

    return {
      mimeType: item.imageMimeType ?? 'image/jpeg',
      data: Buffer.from(item.imageData),
    };
  }

  async getHistory(userId: string, limit = 20) {
    const take = Math.max(1, Math.min(100, limit));
    const items = await this.recommendationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
    });

    return {
      count: items.length,
      items,
    };
  }

  async getPhotoProgress(userId: string, limit = 15) {
    const take = Math.max(2, Math.min(60, limit));
    const recentItems = await this.recommendationRepository.find({
      where: { userId, source: 'image' },
      order: { createdAt: 'DESC' },
      take,
    });

    const points = recentItems
      .reverse()
      .map((item) => this.toProgressPoint(item))
      .filter(
        (
          point,
        ): point is {
          id: string;
          createdAt: string;
          imageUrl: string | null;
          overallSkinScore: number;
          averageConcernSeverity: number;
          confidence: number;
          concernScores: Record<string, number>;
        } => point !== null,
      );

    const labels = points.map((point) =>
      new Date(point.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    );
    const overallSkinScore = points.map((point) => point.overallSkinScore);
    const averageConcernSeverity = points.map(
      (point) => point.averageConcernSeverity,
    );
    const confidence = points.map((point) => point.confidence);

    const latest = points.length > 0 ? points[points.length - 1] : null;
    const previous = points.length > 1 ? points[points.length - 2] : null;

    const comparison = this.buildProgressComparison(previous, latest);

    return {
      count: points.length,
      points,
      chart: {
        labels,
        overallSkinScore,
        averageConcernSeverity,
        confidence,
      },
      comparison,
    };
  }

  private async buildRecommendationResponse(
    profile: NormalizedProfile,
    context: RecommendationContext,
    imageAnalysis: ImageAnalysis | null,
    imageAsset: PersistedImageAsset,
  ) {
    const concerns = profile.concerns;
    const sensitivities = profile.sensitivities;

    const ruleBasedIngredients = this.buildRuleBasedIngredients(
      profile.skinType,
      concerns,
      sensitivities,
    );
    const aiIngredients = await this.getAiIngredients({
      skinType: profile.skinType,
      concerns,
      sensitivities,
      routineGoal: profile.routineGoal,
      budgetLevel: profile.budgetLevel,
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

    const response: Record<string, unknown> = {
      profile: {
        skinType: profile.skinType,
        skinConcerns: concerns,
        sensitivities,
        routineGoal: profile.routineGoal ?? null,
        budgetLevel: profile.budgetLevel ?? null,
      },
      recommendedIngredients,
      ingredientInsights,
      matchingProducts: rankedProducts,
      marketplaceLinks,
      routine: this.buildRoutine(recommendedIngredients, concerns),
      imageAnalysis,
      imageSnapshotUrl: imageAsset.imageUrl,
      meta: {
        source: aiIngredients.length > 0 ? 'ai+rules' : 'rules-only',
        generatedAt: new Date().toISOString(),
        planTier: context.planTier,
        inputSource: context.source,
      },
    };

    if (context.planTier === 'pro') {
      response.proInsights = this.buildProInsights(
        recommendedIngredients,
        concerns,
        imageAnalysis,
      );
    }

    const savedImageUrl = await this.saveHistoryIfNeeded(
      context.userId,
      context.source,
      profile,
      response,
      imageAnalysis,
      imageAsset,
    );

    if (savedImageUrl) {
      response.imageSnapshotUrl = savedImageUrl;
    }

    return response;
  }

  private toProgressPoint(item: Recommendation) {
    const scores = this.extractAnalysisScores(item);
    if (!scores) {
      return null;
    }

    const concernValues = Object.values(scores.concernScores);
    const averageConcernSeverity =
      concernValues.length > 0
        ? Math.round(
            concernValues.reduce((total, value) => total + value, 0) /
              concernValues.length,
          )
        : 0;

    return {
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      imageUrl: item.imageUrl,
      overallSkinScore: scores.overallSkinScore,
      averageConcernSeverity,
      confidence: scores.confidence,
      concernScores: scores.concernScores,
    };
  }

  private buildProgressComparison(
    previous:
      | {
          id: string;
          createdAt: string;
          imageUrl: string | null;
          overallSkinScore: number;
          averageConcernSeverity: number;
          confidence: number;
          concernScores: Record<string, number>;
        }
      | null,
    latest:
      | {
          id: string;
          createdAt: string;
          imageUrl: string | null;
          overallSkinScore: number;
          averageConcernSeverity: number;
          confidence: number;
          concernScores: Record<string, number>;
        }
      | null,
  ) {
    if (!latest) {
      return {
        previous: null,
        latest: null,
        deltas: null,
        summary: 'Upload at least one skin photo to start progress tracking.',
      };
    }

    if (!previous) {
      return {
        previous: null,
        latest,
        deltas: null,
        summary:
          'Upload one more skin photo to unlock before/after comparison insights.',
      };
    }

    const concernDeltas: Record<string, number> = {};
    const keys = new Set([
      ...Object.keys(previous.concernScores),
      ...Object.keys(latest.concernScores),
    ]);

    for (const key of keys) {
      const previousScore = previous.concernScores[key] ?? 0;
      const latestScore = latest.concernScores[key] ?? 0;
      concernDeltas[key] = previousScore - latestScore;
    }

    const overallDelta = latest.overallSkinScore - previous.overallSkinScore;
    const severityDelta =
      previous.averageConcernSeverity - latest.averageConcernSeverity;

    let summary = 'Skin status appears stable between the last two photo check-ins.';
    if (overallDelta >= 4 || severityDelta >= 4) {
      summary = 'Positive trend detected compared to your previous photo.';
    } else if (overallDelta <= -4 || severityDelta <= -4) {
      summary =
        'Recent photo suggests a setback. Consider simplifying actives and focusing on barrier care.';
    }

    return {
      previous,
      latest,
      deltas: {
        overallSkinScore: overallDelta,
        averageConcernSeverity: severityDelta,
        concernDeltas,
      },
      summary,
    };
  }

  private extractAnalysisScores(item: Recommendation): {
    overallSkinScore: number;
    confidence: number;
    concernScores: Record<string, number>;
  } | null {
    const scoresRaw = item.analysisScores as
      | {
          overallSkinScore?: unknown;
          confidence?: unknown;
          concernScores?: Record<string, unknown>;
        }
      | null;

    const fallbackRaw = item.imageAnalysis as
      | {
          overallSkinScore?: unknown;
          confidence?: unknown;
          concernScores?: Record<string, unknown>;
        }
      | null;

    const source = scoresRaw ?? fallbackRaw;
    if (!source) {
      return null;
    }

    const concernScoresRaw = source.concernScores ?? {};
    const concernScores = {
      acne: this.normalizeNumber(concernScoresRaw.acne, 0, 100, 50),
      pigmentation: this.normalizeNumber(
        concernScoresRaw.pigmentation,
        0,
        100,
        50,
      ),
      redness: this.normalizeNumber(concernScoresRaw.redness, 0, 100, 50),
      texture: this.normalizeNumber(concernScoresRaw.texture, 0, 100, 50),
      dehydration: this.normalizeNumber(
        concernScoresRaw.dehydration,
        0,
        100,
        50,
      ),
      oiliness: this.normalizeNumber(concernScoresRaw.oiliness, 0, 100, 50),
    };

    return {
      overallSkinScore: this.normalizeNumber(
        source.overallSkinScore,
        0,
        100,
        50,
      ),
      confidence: this.normalizeNumber(source.confidence, 0, 1, 0.5),
      concernScores,
    };
  }

  private prepareProgressImageAsset(
    image: { buffer: Buffer; mimetype: string },
    userId: string | null,
  ): PersistedImageAsset {
    if (!image?.buffer || image.buffer.length === 0) {
      return {
        imageUrl: null,
        imageData: null,
        imageMimeType: null,
      };
    }

    if (!userId) {
      return {
        imageUrl: null,
        imageData: null,
        imageMimeType: null,
      };
    }

    return {
      imageUrl: null,
      imageData: image.buffer,
      imageMimeType: this.normalizeImageMimeType(image.mimetype),
    };
  }

  private normalizeImageMimeType(mimetype: string): string {
    const allowed = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]);

    return allowed.has(mimetype) ? mimetype : 'image/jpeg';
  }

  private normalizeNumber(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(value * 100) / 100));
  }

  private async saveHistoryIfNeeded(
    userId: string | null,
    source: 'form' | 'image',
    profile: NormalizedProfile,
    recommendation: Record<string, unknown>,
    imageAnalysis: ImageAnalysis | null,
    imageAsset: PersistedImageAsset,
  ): Promise<string | null> {
    if (!userId) {
      return null;
    }

    try {
      const entity = this.recommendationRepository.create({
        userId,
        source,
        profileSnapshot: {
          skinType: profile.skinType,
          concerns: profile.concerns,
          sensitivities: profile.sensitivities,
          routineGoal: profile.routineGoal ?? null,
          budgetLevel: profile.budgetLevel ?? null,
        },
        recommendationSnapshot: {
          recommendedIngredients:
            recommendation.recommendedIngredients ?? ([] as string[]),
          routine: recommendation.routine ?? null,
          meta: recommendation.meta ?? null,
        },
        imageAnalysis,
        imageUrl: imageAsset.imageUrl,
        imageMimeType: imageAsset.imageMimeType,
        imageData: imageAsset.imageData,
        analysisScores: imageAnalysis
          ? {
              overallSkinScore: imageAnalysis.overallSkinScore,
              concernScores: imageAnalysis.concernScores,
              confidence: imageAnalysis.confidence,
            }
          : null,
      });

      const saved = await this.recommendationRepository.save(entity);

      if (saved.imageData) {
        const imageUrl = `/recommend/image/${saved.id}`;
        saved.imageUrl = imageUrl;
        await this.recommendationRepository.save(saved);
        return imageUrl;
      }

      return saved.imageUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to save recommendation history: ${message}`);
      return null;
    }
  }

  private buildProInsights(
    ingredients: string[],
    concerns: string[],
    imageAnalysis: ImageAnalysis | null,
  ) {
    const layeringWarnings: string[] = [];
    if (ingredients.includes('retinol') && ingredients.includes('glycolic acid')) {
      layeringWarnings.push(
        'Do not combine retinol and glycolic acid in the same night routine.',
      );
    }
    if (ingredients.includes('retinol') && ingredients.includes('benzoyl peroxide')) {
      layeringWarnings.push(
        'Alternate retinol and benzoyl peroxide on separate nights.',
      );
    }

    return {
      weeklyFocus: concerns.slice(0, 2),
      layeringWarnings,
      estimatedConsistencyWindow: '8-12 weeks',
      imageConfidence: imageAnalysis?.confidence ?? null,
      observationSummary: imageAnalysis?.observations ?? [],
    };
  }

  private buildNormalizedProfile(dto: RecommendDto): NormalizedProfile {
    return {
      skinType: this.normalizeValue(dto.skinType) || 'normal',
      concerns: this.normalizeUnknownList(dto.skinConcerns),
      sensitivities: this.normalizeUnknownList(dto.sensitivities ?? []),
      routineGoal:
        typeof dto.routineGoal === 'string' ? dto.routineGoal.trim() : undefined,
      budgetLevel:
        typeof dto.budgetLevel === 'string'
          ? dto.budgetLevel.trim().toLowerCase()
          : undefined,
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

  private normalizeUnknownList(values: unknown): string[] {
    if (Array.isArray(values)) {
      return this.normalizeList(
        values.filter((value): value is string => typeof value === 'string'),
      );
    }

    if (typeof values === 'string') {
      const trimmed = values.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (Array.isArray(parsed)) {
            return this.normalizeList(
              parsed.filter(
                (value): value is string => typeof value === 'string',
              ),
            );
          }
        } catch {
          // ignore and fallback to comma split
        }
      }

      return this.normalizeList(trimmed.split(','));
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
