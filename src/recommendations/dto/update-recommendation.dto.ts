import { PartialType } from '@nestjs/swagger';
import { RecommendDto } from './create-recommendation.dto';

export class UpdateRecommendationDto extends PartialType(RecommendDto) {}
