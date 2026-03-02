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
import { AuditService } from '../../audit/audit.service';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';

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

type RateLimitTelemetry = {
  req: Record<string, any>;
  identity: ThrottleIdentity;
  blocked: boolean;
  limit: number;
  windowSec: number;
  retryAfterSec?: number;
};

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(SecurityThrottlerGuard.name);
  private readonly configCacheTtlMs = 15000;
  private readonly blockAuditCooldownMs = this.readEnvNumber('RATE_LIMIT_BLOCK_AUDIT_COOLDOWN_MS', 30000);
  private readonly maxDedupEntries = this.readEnvNumber('RATE_LIMIT_BLOCK_AUDIT_DEDUP_MAX', 5000);
  private cachedRateLimitConfig: RateLimitConfigSnapshot | null = null;
  private rateLimitConfigExpiresAt = 0;
  private readonly blockedAuditDedup = new Map<string, number>();

  // Scope policy to reduce false positives and isolate anonymous/authenticated traffic.
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
    private readonly auditService: AuditService,
    private readonly rateLimitMetricsService: RateLimitMetricsService,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const identity = this.resolveThrottleIdentity(req);
    const rateLimitConfig = await this.getRateLimitConfigCached();

    // Keep limits declared with @Throttle to avoid breaking endpoint-specific rules.
    const moduleLimit = this.toPositiveNumber(throttler?.limit, requestProps.limit);
    const moduleTtl = this.toPositiveNumber(throttler?.ttl, requestProps.ttl);
    const resolvedLimit = this.toPositiveNumber(requestProps.limit, moduleLimit);
    const resolvedTtl = this.toPositiveNumber(requestProps.ttl, moduleTtl);

    let limit = resolvedLimit;
    let ttl = resolvedTtl;

    const hasExplicitRouteConfig = resolvedLimit !== moduleLimit || resolvedTtl !== moduleTtl;

    // If disabled from panel, keep only explicit limits for critical endpoints.
    if (rateLimitConfig?.enabled === false && !hasExplicitRouteConfig) {
      return true;
    }

    // Apply adaptive panel config only when route does not define custom @Throttle.
    if (!hasExplicitRouteConfig && throttler?.name === 'default') {
      if (rateLimitConfig?.enabled === true) {
        limit = this.toPositiveNumber(rateLimitConfig.requests, limit);
        ttl = this.toPositiveNumber(rateLimitConfig.window, 1) * 60000;
      }

      limit = this.applyScopePolicy(limit, identity.scope, identity.path);
    }

    const allowed = await super.handleRequest({
      ...requestProps,
      limit,
      ttl,
      // Force tracker key by scope to preserve multitenant and API key isolation.
      getTracker: async () => identity.tracker,
    });

    if (allowed) {
      this.captureRateLimitTelemetry({
        req,
        identity,
        blocked: false,
        limit,
        windowSec: Math.max(1, Math.ceil(ttl / 1000)),
      });
    }

    return allowed;
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

    // RFC-compliant + modern headers.
    res.header('Retry-After', String(retryAfterSec));
    res.header('RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('RateLimit-Remaining', '0');
    res.header('RateLimit-Reset', String(retryAfterSec));
    res.header('RateLimit-Policy', `${throttlerLimitDetail.limit};w=${windowSec}`);

    // Legacy compatibility headers.
    res.header('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('X-RateLimit-Remaining', '0');
    res.header('X-RateLimit-Reset', String(retryAfterSec));

    const identity = this.resolveThrottleIdentity(req);
    this.captureRateLimitTelemetry({
      req,
      identity,
      blocked: true,
      limit: throttlerLimitDetail.limit,
      windowSec,
      retryAfterSec,
    });

    throw new HttpException(
      {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisicoes em curto periodo. Aguarde alguns instantes e tente novamente.',
        retryAfterSec,
        windowSec,
        limit: throttlerLimitDetail.limit,
        path: this.getRequestPath(req),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private captureRateLimitTelemetry(data: RateLimitTelemetry): void {
    void this.recordRateLimitTelemetry(data);
  }

  private async recordRateLimitTelemetry(data: RateLimitTelemetry): Promise<void> {
    const tenantId = this.resolveTenantId(data.req);
    const userId = this.normalizeText(data.req?.user?.id || data.req?.user?.sub);

    try {
      await this.rateLimitMetricsService.record({
        tenantId,
        scope: data.identity.scope,
        path: data.identity.path,
        blocked: data.blocked,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar metricas de rate limit. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!data.blocked) {
      return;
    }

    if (!this.shouldAuditBlockedEvent(data, tenantId)) {
      return;
    }

    try {
      await this.auditService.log({
        action: 'RATE_LIMIT_BLOCKED',
        userId: userId || undefined,
        tenantId: tenantId || undefined,
        ipAddress: data.identity.clientIp,
        userAgent: this.resolveUserAgent(data.req),
        details: {
          scope: data.identity.scope,
          tracker: data.identity.tracker,
          path: data.identity.path,
          method: this.resolveRequestMethod(data.req),
          limit: data.limit,
          windowSec: data.windowSec,
          retryAfterSec: data.retryAfterSec ?? 0,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar auditoria de bloqueio de rate limit. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private shouldAuditBlockedEvent(data: RateLimitTelemetry, tenantId: string | null): boolean {
    const now = Date.now();
    const method = this.resolveRequestMethod(data.req);
    const dedupKey = [
      tenantId || 'anonymous',
      method,
      data.identity.scope,
      data.identity.path,
      data.identity.tracker,
    ].join('|');

    const lastSeenAt = this.blockedAuditDedup.get(dedupKey);
    if (typeof lastSeenAt === 'number' && now - lastSeenAt < this.blockAuditCooldownMs) {
      return false;
    }

    this.blockedAuditDedup.set(dedupKey, now);
    this.pruneBlockedAuditDedup(now);
    return true;
  }

  private pruneBlockedAuditDedup(now: number): void {
    if (this.blockedAuditDedup.size <= this.maxDedupEntries) {
      return;
    }

    for (const [key, timestamp] of this.blockedAuditDedup.entries()) {
      if (now - timestamp >= this.blockAuditCooldownMs) {
        this.blockedAuditDedup.delete(key);
      }

      if (this.blockedAuditDedup.size <= this.maxDedupEntries) {
        return;
      }
    }

    while (this.blockedAuditDedup.size > this.maxDedupEntries) {
      const oldestKey = this.blockedAuditDedup.keys().next().value;
      if (!oldestKey) {
        return;
      }
      this.blockedAuditDedup.delete(oldestKey);
    }
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

    const tenantId = this.resolveTenantId(req);
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

  private resolveTenantId(req: Record<string, any>): string | null {
    return this.normalizeText(req?.apiKey?.tenantId || req?.user?.tenantId || req?.tenantId);
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

  private resolveRequestMethod(req: Record<string, any>): string {
    const method = this.normalizeText(req?.method);
    return method ? method.toUpperCase() : 'UNKNOWN';
  }

  private resolveUserAgent(req: Record<string, any>): string | undefined {
    const header = req?.headers?.['user-agent'];
    const userAgent = Array.isArray(header) ? header[0] : header;

    if (typeof userAgent !== 'string') {
      return undefined;
    }

    const normalized = userAgent.trim();
    return normalized.length > 0 ? normalized : undefined;
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
