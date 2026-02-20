import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type AuthTokenPayload = {
  sub: string;
  email: string;
  planTier: 'free' | 'pro';
  iat: number;
  exp: number;
};

@Injectable()
export class AuthTokenService {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: { sub: string; email: string; planTier: 'free' | 'pro' }) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7;
    const body: AuthTokenPayload = {
      ...payload,
      iat: now,
      exp,
    };

    const header = this.toBase64Url(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf-8'),
    );
    const encodedPayload = this.toBase64Url(
      Buffer.from(JSON.stringify(body), 'utf-8'),
    );

    const content = `${header}.${encodedPayload}`;
    const signature = this.signContent(content);
    return `${content}.${signature}`;
  }

  verify(token: string): AuthTokenPayload {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid auth token.');
    }

    const content = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.signContent(content);

    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('Invalid auth token signature.');
    }

    let payload: AuthTokenPayload;
    try {
      payload = JSON.parse(
        this.fromBase64Url(encodedPayload).toString('utf-8'),
      ) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid auth token payload.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new UnauthorizedException('Auth token expired.');
    }

    return payload;
  }

  private signContent(content: string) {
    return this.toBase64Url(
      createHmac('sha256', this.getSecret()).update(content).digest(),
    );
  }

  private getSecret() {
    return this.configService.get<string>('AUTH_SECRET') ?? 'dev-secret-change-me';
  }

  private toBase64Url(input: Buffer) {
    return input
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private fromBase64Url(input: string) {
    const base64 = input
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(input.length / 4) * 4, '=');

    return Buffer.from(base64, 'base64');
  }
}
