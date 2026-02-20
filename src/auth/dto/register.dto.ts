import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'zoe@example.com' })
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  password: string;

  @ApiProperty({ example: 'Zoe', required: false })
  name?: string;
}
