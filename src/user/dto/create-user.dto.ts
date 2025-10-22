import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiProperty({ description: 'Skin type of the user', example: 'dry' })
  skinType: string;

  @ApiProperty({
    description: 'Skin concerns of the user',
    example: ['acne', 'pigmentation'],
    isArray: true,
  })
  skinConcerns: string[];
}
