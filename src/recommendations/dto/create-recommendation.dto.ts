import { ApiProperty } from '@nestjs/swagger';

export class RecommendDto {
  @ApiProperty({ description: 'Skin type of the user', example: 'combination' })
  skinType: string;

  @ApiProperty({
    description: 'Skin concerns of the user',
    example: ['acne', 'sensitivity'],
    isArray: true,
  })
  skinConcerns: string[];
}
