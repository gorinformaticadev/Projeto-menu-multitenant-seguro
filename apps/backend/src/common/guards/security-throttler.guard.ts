import { Injectable, ExecutionContext, Logger, HttpException, HttpStatus } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  ThrottlerModuleOptions,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { SecurityConfigService } from '../../security-config/security-config.service';

type ThrottleScope = 'ip' | 'user' | 'tenant-user' | 'tenant' | 'api-key';

type ThrottleIdentity = {
  scope: ThrottleScope;
  tracker: string;
  path: string;
  clientIp: string;
};

type RateLimitConfigSnapshot = {
  enabled: boolean;
  requests: number;
  window: number;
  isProduction: boolean;
};

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(SecurityThrottlerGuard.name);
  private readonly configCacheTtlMs = 15000;
  private cachedRateLimitConfig: RateLimitConfigSnapshot | null = null;
  private rateLimitConfigExpiresAt = 0;

  // Política por escopo para reduzir falso positivo e separar tráfego anônimo/autenticado.
  private readonly anonymousLimitCap = this.readEnvNumber('RATE_LIMIT_ANON_LIMIT', 120);
  private readonly userLimitFloor = this.readEnvNumber('RATE_LIMIT_USER_LIMIT', 1000);
  private readonly tenantLimitFloor = this.readEnvNumber('RATE_LIMIT_TENANT_LIMIT', 2000);
  private readonly apiKeyLimitFloor = this.readEnvNumber('RATE_LIMIT_API_KEY_LIMIT', 1500);
  private readonly dashboardLimitFloor = this.readEnvNumber('RATE_LIMIT_DASHBOARD_LIMIT', 2500);

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securityConfigService: SecurityConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const identity = this.resolveThrottleIdentity(req);
    const rateLimitConfig = await this.getRateLimitConfigCached();

    // Mantém limites declarados em @Throttle para não quebrar regras por endpoint.
    const moduleLimit = this.toPositiveNumber(throttler?.limit, requestProps.limit);
    const moduleTtl = this.toPositiveNumber(throttler?.ttl, requestProps.ttl);
    const resolvedLimit = this.toPositiveNumber(requestProps.limit, moduleLimit);
    const resolvedTtl = this.toPositiveNumber(requestProps.ttl, moduleTtl);

    let limit = resolvedLimit;
    let ttl = resolvedTtl;

    const hasExplicitRouteConfig = resolvedLimit !== moduleLimit || resolvedTtl !== moduleTtl;

    // Se desativado no painel, mantém apenas limites explícitos de endpoints críticos.
    if (rateLimitConfig?.enabled === false && !hasExplicitRouteConfig) {
      return true;
    }

    // Aplica configuração adaptativa do painel apenas quando a rota não define @Throttle próprio.
    if (!hasExplicitRouteConfig && throttler?.name === 'default') {
      if (rateLimitConfig?.enabled === true) {
        limit = this.toPositiveNumber(rateLimitConfig.requests, limit);
        ttl = this.toPositiveNumber(rateLimitConfig.window, 1) * 60000;
      }

      limit = this.applyScopePolicy(limit, identity.scope, identity.path);
    }

    return super.handleRequest({
      ...requestProps,
      limit,
      ttl,
      // Força chave por escopo para isolamento multitenant e API key.
      getTracker: async () => identity.tracker,
    });
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return this.resolveThrottleIdentity(req).tracker;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { req, res } = this.getRequestResponse(context);
    const retryAfterSec = Math.max(
      1,
      this.toPositiveNumber(
        throttlerLimitDetail.timeToBlockExpire || throttlerLimitDetail.timeToExpire,
        1,
      ),
    );
    const windowSec = Math.max(1, Math.ceil(throttlerLimitDetail.ttl / 1000));

    // RFC e padrão moderno de headers.
    res.header('Retry-After', String(retryAfterSec));
    res.header('RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('RateLimit-Remaining', '0');
    res.header('RateLimit-Reset', String(retryAfterSec));
    res.header('RateLimit-Policy', `${throttlerLimitDetail.limit};w=${windowSec}`);

    // Compatibilidade com cabeçalhos legados usados pelo throttler.
    res.header('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('X-RateLimit-Remaining', '0');
    res.header('X-RateLimit-Reset', String(retryAfterSec));

    throw new HttpException({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message:
        'Muitas requisicoes em curto periodo. Aguarde alguns instantes e tente novamente.',
      retryAfterSec,
      windowSec,
      limit: throttlerLimitDetail.limit,
      path: this.getRequestPath(req),
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  private applyScopePolicy(baseLimit: number, scope: ThrottleScope, path: string): number {
    let limit = baseLimit;

    if (scope === 'ip') {
      limit = Math.min(limit, this.anonymousLimitCap);
    } else if (scope === 'tenant-user' || scope === 'user') {
      limit = Math.max(limit, this.userLimitFloor);
    } else if (scope === 'tenant') {
      limit = Math.max(limit, this.tenantLimitFloor);
    } else if (scope === 'api-key') {
      limit = Math.max(limit, this.apiKeyLimitFloor);
    }

    if (this.isDashboardLikePath(path) && scope !== 'ip') {
      limit = Math.max(limit, this.dashboardLimitFloor);
    }

    return limit;
  }

  private resolveThrottleIdentity(req: Record<string, any>): ThrottleIdentity {
    const path = this.getRequestPath(req);
    const clientIp = this.resolveClientIp(req);

    const tenantId = this.normalizeText(req?.apiKey?.tenantId || req?.user?.tenantId || req?.tenantId);
    const apiKeyId = this.normalizeText(req?.apiKey?.id || req?.user?.apiKeyId || req?.auth?.apiKeyId);

    if (apiKeyId) {
      return {
        scope: 'api-key',
        tracker: `tenant:${tenantId || 'global'}:api-key:${apiKeyId}`,
        path,
        clientIp,
      };
    }

    const userId = this.normalizeText(req?.user?.id || req?.user?.sub);
    if (userId && tenantId) {
      return {
        scope: 'tenant-user',
        tracker: `tenant:${tenantId}:user:${userId}`,
        path,
        clientIp,
      };
    }
    if (userId) {
      return {
        scope: 'user',
        tracker: `user:${userId}`,
        path,
        clientIp,
      };
    }
    if (tenantId) {
      return {
        scope: 'tenant',
        tracker: `tenant:${tenantId}`,
        path,
        clientIp,
      };
    }

    const authTarget = this.resolveAuthTarget(path, req);
    if (authTarget) {
      return {
        scope: 'ip',
        tracker: `ip:${clientIp}:target:${this.hashIdentifier(authTarget)}`,
        path,
        clientIp,
      };
    }

    return {
      scope: 'ip',
      tracker: `ip:${clientIp}`,
      path,
      clientIp,
    };
  }

  private resolveAuthTarget(path: string, req: Record<string, any>): string | null {
    const email = this.normalizeText(req?.body?.email);
    const token = this.normalizeText(req?.body?.token);

    if (
      path.includes('/auth/login') ||
      path.includes('/auth/login-2fa') ||
      path.includes('/auth/forgot-password')
    ) {
      return email;
    }

    if (path.includes('/auth/reset-password') || path.includes('/auth/email/verify')) {
      return token;
    }

    return null;
  }

  private isDashboardLikePath(path: string): boolean {
    return (
      path.includes('/dashboard') ||
      path.includes('/notifications') ||
      path.includes('/audit-logs')
    );
  }

  private getRequestPath(req: Record<string, any>): string {
    const rawPath = this.normalizeText(req?.originalUrl || req?.url || req?.path || req?.route?.path) || '/';
    const [pathWithoutQuery] = rawPath.split('?');
    return pathWithoutQuery.toLowerCase();
  }

  private resolveClientIp(req: Record<string, any>): string {
    if (typeof req?.ip === 'string' && req.ip.trim().length > 0) {
      return req.ip.trim();
    }

    const forwardedForHeader = req?.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIpHeader = req?.headers?.['x-real-ip'];
    const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
      return realIp.trim();
    }

    return 'unknown';
  }

  private normalizeText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = String(value).trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private hashIdentifier(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 24);
  }

  private toPositiveNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }

  private readEnvNumber(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }

  private async getRateLimitConfigCached(): Promise<RateLimitConfigSnapshot | null> {
    const now = Date.now();

    if (this.cachedRateLimitConfig && now < this.rateLimitConfigExpiresAt) {
      return this.cachedRateLimitConfig;
    }

    try {
      const config = await this.securityConfigService.getRateLimitConfig();
      this.cachedRateLimitConfig = config;
      this.rateLimitConfigExpiresAt = now + this.configCacheTtlMs;
      return config;
    } catch (error) {
      this.cachedRateLimitConfig = null;
      this.rateLimitConfigExpiresAt = now + this.configCacheTtlMs;
      this.logger.warn(
        `Falha ao carregar config de rate limit do banco; usando limites do modulo. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
