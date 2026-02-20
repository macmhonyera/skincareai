import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenService, AuthTokenPayload } from './auth-token.service';

type OptionalAuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
};

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<OptionalAuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return true;
    }

    const [scheme, token] = authHeader.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
      return true;
    }

    request.user = this.authTokenService.verify(token);
    return true;
  }
}
