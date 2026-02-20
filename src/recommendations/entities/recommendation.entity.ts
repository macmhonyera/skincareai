import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', default: 'form' })
  source: 'form' | 'image';

  @Column('simple-json')
  profileSnapshot: Record<string, unknown>;

  @Column('simple-json')
  recommendationSnapshot: Record<string, unknown>;

  @Column('simple-json', { nullable: true })
  imageAnalysis: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column('simple-json', { nullable: true })
  analysisScores: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
