import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendDto {
  @ApiProperty({ description: 'Skin type of the user', example: 'combination' })
  skinType: string;

  @ApiProperty({
    description: 'Skin concerns of the user',
    example: ['acne', 'sensitivity'],
    isArray: true,
  })
  skinConcerns: string[];

  @ApiPropertyOptional({
    description: 'Known ingredient sensitivities or allergies',
    example: ['fragrance', 'essential oils'],
    isArray: true,
  })
  sensitivities?: string[];

  @ApiPropertyOptional({
    description: 'Current skincare objective',
    example: 'calm breakouts while fading marks',
  })
  routineGoal?: string;

  @ApiPropertyOptional({
    description: 'Preferred budget level for product selection',
    example: 'medium',
  })
  budgetLevel?: string;

  @ApiPropertyOptional({
    description: 'Optional context when submitting a skin photo',
    example: 'Taken in daylight without makeup',
  })
  photoNotes?: string;
}
