import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

type NotificationsJwtPayload = Record<string, unknown>;
type NotificationsSseRequest = Request & {
  user?: NotificationsJwtPayload;
};

@Injectable()
export class NotificationsSseJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<NotificationsSseRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token nao fornecido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<NotificationsJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: false,
      });

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  private extractToken(request: NotificationsSseRequest): string | null {
    const authHeader = request.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      if (bearerToken) {
        return bearerToken;
      }
    }

    const queryToken = request.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    return null;
  }
}
