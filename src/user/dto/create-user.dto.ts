import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiProperty({
    description: 'Display name',
    example: 'Zoe',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Skin type of the user',
    example: 'dry',
    required: false,
  })
  skinType?: string;

  @ApiProperty({
    description: 'Skin concerns of the user',
    example: ['acne', 'pigmentation'],
    isArray: true,
    required: false,
  })
  skinConcerns?: string[];

  @ApiProperty({
    description: 'Known ingredient sensitivities',
    example: ['fragrance'],
    isArray: true,
    required: false,
  })
  sensitivities?: string[];

  @ApiProperty({
    description: 'Current routine goal',
    example: 'Control breakouts and fade marks',
    required: false,
  })
  routineGoal?: string;

  @ApiProperty({
    description: 'Budget preference',
    example: 'medium',
    required: false,
  })
  budgetLevel?: string;
}
