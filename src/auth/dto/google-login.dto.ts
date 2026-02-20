import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: 'Google Identity Services ID token from frontend',
  })
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Google OAuth access token from frontend',
  })
  accessToken?: string;
}
