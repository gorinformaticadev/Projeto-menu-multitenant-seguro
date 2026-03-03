import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SseJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError' && this.isSseProgressRequest(request)) {
        const decoded = this.jwtService.decode(token);
        if (!decoded || typeof decoded !== 'object') {
          throw new UnauthorizedException('Token invalido');
        }

        request.user = decoded;
        this.logger.warn('Token expirado aceito apenas para stream de progresso SSE.');
        return true;
      }

      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  private extractToken(request: any): string | null {
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

  private readQueryToken(request: any, key: 'token' | 'downloadToken'): string | null {
    const value = request.query?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  }

  private isSseProgressRequest(request: any): boolean {
    const requestPath = String(request.path || request.url || '');
    return requestPath.includes('/backup/progress/');
  }
}
