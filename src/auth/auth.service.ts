import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokenService, AuthTokenPayload } from './auth-token.service';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { User } from '../user/entities/user.entity';
import { GoogleLoginDto } from './dto/google-login.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

const scryptAsync = promisify(scrypt);

type GoogleTokenInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  aud?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authTokenService: AuthTokenService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.password?.trim();
    if (!password || password.length < 8) {
      throw new BadRequestException(
        'Password must have at least 8 characters.',
      );
    }

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    const passwordHash = await this.hashPassword(password);
    const createdUser = await this.userService.save({
      email,
      name: dto.name?.trim() || null,
      passwordHash,
      googleId: null,
      authProvider: 'local',
      skinType: null,
      skinConcerns: null,
      sensitivities: null,
      routineGoal: null,
      budgetLevel: null,
      planTier: 'free',
      profileImageUrl: null,
      lastLoginAt: new Date(),
    });

    return this.buildAuthResponse(createdUser);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    user.lastLoginAt = new Date();
    const savedUser = await this.userService.save(user);
    return this.buildAuthResponse(savedUser);
  }

  async googleLogin(dto: GoogleLoginDto) {
    if (!dto.idToken && !dto.accessToken) {
      throw new BadRequestException(
        'Google ID token or access token is required.',
      );
    }

    const googleInfo = dto.idToken
      ? await this.verifyGoogleIdToken(dto.idToken)
      : await this.verifyGoogleAccessToken(dto.accessToken!);

    let user = await this.userService.findByGoogleId(googleInfo.sub);
    if (!user) {
      user = await this.userService.findByEmail(googleInfo.email);
    }

    if (!user) {
      user = await this.userService.save({
        email: googleInfo.email,
        name: googleInfo.name?.trim() || null,
        passwordHash: null,
        googleId: googleInfo.sub,
        authProvider: 'google',
        skinType: null,
        skinConcerns: null,
        sensitivities: null,
        routineGoal: null,
        budgetLevel: null,
        planTier: 'free',
        profileImageUrl: googleInfo.picture ?? null,
        lastLoginAt: new Date(),
      });
    } else {
      user.googleId = googleInfo.sub;
      user.authProvider = 'google';
      user.name = user.name || googleInfo.name?.trim() || null;
      user.profileImageUrl = user.profileImageUrl || googleInfo.picture || null;
      user.lastLoginAt = new Date();
      user = await this.userService.save(user);
    }

    return this.buildAuthResponse(user);
  }

  async me(authPayload: AuthTokenPayload) {
    const user = await this.userService.findOne(authPayload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return this.userService.sanitizeUser(user);
  }

  async updatePlan(authPayload: AuthTokenPayload, dto: UpgradePlanDto) {
    const user = await this.userService.findOne(authPayload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    user.planTier = dto.planTier;
    const savedUser = await this.userService.save(user);
    return this.buildAuthResponse(savedUser);
  }

  getClientConfig() {
    return {
      googleClientId: this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
    };
  }

  private buildAuthResponse(user: User) {
    const token = this.authTokenService.sign({
      sub: user.id,
      email: user.email,
      planTier: user.planTier,
    });

    return {
      token,
      user: this.userService.sanitizeUser(user),
      proFeaturesUnlocked: user.planTier === 'pro',
    };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const key = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }

  private async verifyPassword(password: string, storedHash: string) {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      return false;
    }

    const key = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(hash, 'hex');
    if (key.length !== keyBuffer.length) {
      return false;
    }
    return timingSafeEqual(key, keyBuffer);
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://oauth2.googleapis.com/tokeninfo', {
          params: {
            id_token: idToken,
          },
        }),
      );

      const payload = response.data as GoogleTokenInfo;
      if (!payload.email || !payload.sub) {
        throw new UnauthorizedException('Invalid Google token.');
      }

      return {
        ...payload,
        email: payload.email.trim().toLowerCase(),
      };
    } catch {
      throw new UnauthorizedException('Google token verification failed.');
    }
  }

  private async verifyGoogleAccessToken(
    accessToken: string,
  ): Promise<GoogleTokenInfo> {
    try {
      const tokenInfoResponse = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/oauth2/v3/tokeninfo', {
          params: { access_token: accessToken },
        }),
      );

      const tokenInfo = tokenInfoResponse.data as {
        aud?: string;
      };
      const requiredClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      if (requiredClientId && tokenInfo.aud && tokenInfo.aud !== requiredClientId) {
        throw new UnauthorizedException('Google token audience mismatch.');
      }

      const userInfoResponse = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      const userInfo = userInfoResponse.data as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      if (!userInfo.sub || !userInfo.email) {
        throw new UnauthorizedException('Invalid Google user profile.');
      }

      return {
        sub: userInfo.sub,
        email: userInfo.email.trim().toLowerCase(),
        name: userInfo.name,
        picture: userInfo.picture,
        aud: tokenInfo.aud,
      };
    } catch {
      throw new UnauthorizedException('Google access token verification failed.');
    }
  }
}
