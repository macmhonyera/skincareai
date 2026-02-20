import { ApiProperty } from '@nestjs/swagger';

export class UpgradePlanDto {
  @ApiProperty({
    enum: ['free', 'pro'],
    example: 'pro',
  })
  planTier: 'free' | 'pro';
}
