import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

type SseAuthPayload = {
  sub?: string;
  [key: string]: unknown;
};

type SseRequest = Request & {
  user?: SseAuthPayload;
  downloadTokenPayload?: SseAuthPayload;
};

@Injectable()
export class SseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SseJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SseRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token nao fornecido');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: false,
      });

      request.user = payload;

      if (this.readQueryToken(request, 'downloadToken')) {
        request.downloadTokenPayload = payload;
      }

      return true;
    } catch (error: unknown) {
      const errorName = this.getErrorName(error);
      if (errorName === 'TokenExpiredError' && this.isSseProgressRequest(request)) {
        const decoded = this.jwtService.decode(token);
        if (!decoded || typeof decoded !== 'object') {
          throw new UnauthorizedException('Token invalido');
        }

        request.user = decoded as SseAuthPayload;
        this.logger.warn('Token expirado aceito apenas para stream de progresso SSE.');
        return true;
      }

      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  private extractToken(request: SseRequest): string | null {
    const authHeader = request.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      if (bearerToken) {
        return bearerToken;
      }
    }

    const downloadToken = this.readQueryToken(request, 'downloadToken');
    if (downloadToken) {
      return downloadToken;
    }

    const queryToken = this.readQueryToken(request, 'token');
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  private readQueryToken(request: SseRequest, key: 'token' | 'downloadToken'): string | null {
    const value = request.query?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  }

  private isSseProgressRequest(request: SseRequest): boolean {
    const requestPath = String(request.path || request.url || '');
    return requestPath.includes('/backup/progress/');
  }

  private getErrorName(error: unknown): string {
    if (error instanceof Error) {
      return error.name;
    }

    if (error && typeof error === 'object' && 'name' in error) {
      const name = error.name;
      return typeof name === 'string' ? name : '';
    }

    return '';
  }
}
