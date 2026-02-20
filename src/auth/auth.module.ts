import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthTokenService } from './auth-token.service';
import { AuthGuard } from './auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, AuthGuard, OptionalAuthGuard],
  exports: [AuthTokenService, AuthGuard, OptionalAuthGuard],
})
export class AuthModule {}
