import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthGuard } from './auth.guard';
import { Request } from 'express';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { AuthTokenPayload } from './auth-token.service';

type AuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user!);
  }

  @UseGuards(AuthGuard)
  @Patch('plan')
  updatePlan(@Req() req: AuthenticatedRequest, @Body() dto: UpgradePlanDto) {
    return this.authService.updatePlan(req.user!, dto);
  }

  @Get('pro-features')
  listProFeatures() {
    return {
      features: [
        'AI skin photo analysis and concern detection',
        'Saved recommendation history and profile memory',
        'Advanced weekly AM/PM routine builder',
        'Priority ingredient conflict warnings',
        'Personalized progress insights over time',
      ],
    };
  }

  @Get('client-config')
  getClientConfig() {
    return this.authService.getClientConfig();
  }
}
