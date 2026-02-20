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
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

const scryptAsync = promisify(scrypt);

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authTokenService: AuthTokenService,
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
}
