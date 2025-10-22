import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Name of the product' })
  name: string;

  @ApiProperty({ description: 'Brand name of the product' })
  brand: string;

  @ApiProperty({
    description: 'List of ingredients in the product',
    isArray: true,
    type: String,
  })
  ingredients: string[];

  @ApiProperty({ description: 'URL to purchase the product' })
  purchaseUrl: string;
}
