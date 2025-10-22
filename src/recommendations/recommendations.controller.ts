import { Controller, Post, Body } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendDto } from './dto/create-recommendation.dto';

@Controller('recommend')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post()
  async recommend(@Body() recommendDto: RecommendDto) {
    return this.recommendationsService.getRecommendations(recommendDto);
  }
}
