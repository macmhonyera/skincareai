import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  skinType: string | null;

  @Column('simple-array', { nullable: true })
  skinConcerns: string[] | null;

  @Column('simple-array', { nullable: true })
  sensitivities: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  routineGoal: string | null;

  @Column({ type: 'varchar', nullable: true })
  budgetLevel: string | null;

  @Column({ type: 'varchar', default: 'free' })
  planTier: 'free' | 'pro';

  @Column({ type: 'varchar', nullable: true })
  profileImageUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
