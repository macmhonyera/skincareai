import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique ID of the product' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Name of the product' })
  name: string;

  @Column()
  @ApiProperty({ description: 'Brand name of the product' })
  brand: string;

  @Column('simple-array')
  @ApiProperty({
    description: 'List of ingredients in the product',
    isArray: true,
  })
  ingredients: string[];

  @Column()
  @ApiProperty({ description: 'URL to purchase the product' })
  purchaseUrl: string;
}
