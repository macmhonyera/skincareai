import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Ingredient {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique ID of the ingredient' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Name of the ingredient' })
  name: string;

  @Column()
  @ApiProperty({
    description: 'Description of the ingredient and its function',
  })
  description: string;

  @Column('simple-array')
  @ApiProperty({
    description: 'List of skin benefits',
    example: ['acne reduction', 'moisturizing'],
    isArray: true,
  })
  benefits: string[];
}
