import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import {
  CSRF_COOKIE_NAME,
  ensureCsrfCookie,
} from '../utils/csrf-token.util';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * CSRF Guard - Double submit cookie
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly configCacheTtlMs = 15000;
  private cachedEnabled: boolean | null = null;
  private configExpiresAt = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly configResolver: ConfigResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const csrfEnabled = await this.isCsrfEnabledCached();
    if (!csrfEnabled) {
      return true;
    }

    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = String(request.method || 'GET').toUpperCase();

    if (!this.isValidOrigin(request)) {
      throw new ForbiddenException('Origem da requisicao invalida');
    }

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      this.setCsrfToken(request, response);
      return true;
    }

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers['x-csrf-token'] || request.headers['x-xsrf-token'];

    if (process.env.NODE_ENV !== 'production') {
      if (!cookieToken && !headerToken) {
        this.setCsrfToken(request, response);
        return true;
      }

      if (cookieToken || headerToken) {
        return true;
      }
    }

    if (!cookieToken || !headerToken) {
      this.logSuspiciousActivity(request, 'TOKEN_MISSING');
      throw new ForbiddenException('Token CSRF ausente');
    }

    if (cookieToken !== headerToken) {
      this.logSuspiciousActivity(request, 'TOKEN_MISMATCH');
      throw new ForbiddenException('Token CSRF invalido');
    }

    if (!this.isValidTokenAge(cookieToken)) {
      this.logSuspiciousActivity(request, 'TOKEN_EXPIRED');
      throw new ForbiddenException('Token CSRF expirado');
    }

    return true;
  }

  private setCsrfToken(request: any, response: any): void {
    ensureCsrfCookie(response, request.cookies?.[CSRF_COOKIE_NAME]);
  }

  private isValidOrigin(request: any): boolean {
    const origin = request.headers.origin;
    const referer = request.headers.referer;

    if (process.env.NODE_ENV !== 'production') {
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (
            originUrl.hostname === 'localhost' ||
            originUrl.hostname === '127.0.0.1' ||
            originUrl.hostname.startsWith('192.168.') ||
            originUrl.hostname.startsWith('10.')
          ) {
            return true;
          }
        } catch {
          // URL invalida, continua fallback de desenvolvimento.
        }
      }

      return true;
    }

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://seu-dominio.com',
      'https://www.seu-dominio.com',
    ].filter(Boolean);

    if (origin && allowedOrigins.includes(origin)) {
      return true;
    }

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        return allowedOrigins.some((allowed) => refererUrl.origin === allowed);
      } catch {
        return false;
      }
    }

    return false;
  }

  private isValidTokenAge(token: string): boolean {
    return token.length === 64;
  }

  private logSuspiciousActivity(request: any, reason: string): void {
    console.warn('Atividade suspeita detectada:', {
      reason,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private async isCsrfEnabledCached(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedEnabled !== null && now < this.configExpiresAt) {
      return this.cachedEnabled;
    }

    this.cachedEnabled = (await this.configResolver.getBoolean('security.csrf.enabled')) === true;
    this.configExpiresAt = now + this.configCacheTtlMs;
    return this.cachedEnabled;
  }
}
