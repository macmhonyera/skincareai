import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { MistralService } from '../ai/mistral.service';
import { ProductsService } from '../products/products.service';
import { IngredientsService } from '../ingredient/ingredient.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Recommendation } from './entities/recommendation.entity';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: MistralService,
          useValue: {
            getIngredientAdvice: jest.fn(),
            analyzeSkinImage: jest.fn(),
          },
        },
        {
          provide: ProductsService,
          useValue: { findByIngredients: jest.fn() },
        },
        {
          provide: IngredientsService,
          useValue: { findByNames: jest.fn() },
        },
        {
          provide: MarketplaceService,
          useValue: { searchProductsByIngredient: jest.fn() },
        },
        {
          provide: getRepositoryToken(Recommendation),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
