import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'zoe@example.com' })
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  password: string;
}
