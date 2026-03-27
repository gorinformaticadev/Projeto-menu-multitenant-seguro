import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { SecurityRuntimeConfigService } from '@core/security-config/security-runtime-config.service';
import { AuditService } from '../../audit/audit.service';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';
import {
  CRITICAL_RATE_LIMIT_KEY,
  CriticalRateLimitAction,
} from '../decorators/critical-rate-limit.decorator';
import { SharedThrottlerStorageUnavailableError } from '../services/redis-throttler.storage';

type ThrottleScope = 'ip' | 'user' | 'tenant-user' | 'tenant' | 'api-key';

type ThrottleIdentity = {
  scope: ThrottleScope;
  tracker: string;
  path: string;
  clientIp: string;
};

type PrincipalIdentity = {
  userId: string | null;
  tenantId: string | null;
  apiKeyId: string | null;
};

type VerifiedJwtPayload = {
  sub?: unknown;
  tenantId?: unknown;
  apiKeyId?: unknown;
  exp?: unknown;
  [key: string]: unknown;
};

type RateLimitExecution = {
  kind: 'global' | 'critical' | 'route';
  category?: CriticalRateLimitAction;
  tracker: string;
  keyPrefix: string;
  limit: number;
  ttl: number;
};

type HeaderValue = string | string[] | undefined;

interface RequestUserLike {
  id?: unknown;
  sub?: unknown;
  tenantId?: unknown;
  apiKeyId?: unknown;
}

interface RequestApiKeyLike {
  id?: unknown;
  tenantId?: unknown;
}

interface RequestAuthLike {
  apiKeyId?: unknown;
}

interface RequestRouteLike {
  path?: unknown;
}

interface RequestLike {
  ip?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  path?: unknown;
  method?: unknown;
  route?: RequestRouteLike;
  headers?: Record<string, HeaderValue>;
  body?: Record<string, unknown>;
  user?: RequestUserLike;
  apiKey?: RequestApiKeyLike;
  auth?: RequestAuthLike;
  tenantId?: unknown;
  __rateLimitContext?: RateLimitExecution;
}

type RateLimitTelemetry = {
  req: RequestLike;
  identity: ThrottleIdentity;
  blocked: boolean;
  limit: number;
  windowSec: number;
  retryAfterSec?: number;
  kind: RateLimitExecution['kind'];
  category?: CriticalRateLimitAction;
};

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(SecurityThrottlerGuard.name);
  private readonly jwtVerifier: JwtService | null;
  private readonly jwtSecret: string | null;
  private hasLoggedMissingJwtSecret = false;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securityRuntimeConfigService: SecurityRuntimeConfigService,
    private readonly auditService: AuditService,
    private readonly rateLimitMetricsService: RateLimitMetricsService,
    private readonly systemTelemetryService: SystemTelemetryService,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    const rawSecret = this.configService.get<string>('JWT_SECRET');
    const normalizedSecret = this.normalizeOpaqueString(rawSecret);
    this.jwtSecret = normalizedSecret;
    this.jwtVerifier = normalizedSecret ? new JwtService({ secret: normalizedSecret }) : null;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest<RequestLike>();
    const identity = this.resolveThrottleIdentity(req);
    const execution = await this.resolveRateLimitExecution(requestProps, identity);

    if (!execution) {
      return true;
    }

    req.__rateLimitContext = execution;

    try {
      const allowed = await super.handleRequest({
        ...requestProps,
        limit: execution.limit,
        ttl: execution.ttl,
        blockDuration: execution.ttl,
        getTracker: async () => execution.tracker,
        generateKey: (_ctx, tracker, name) => `${execution.keyPrefix}:${name}:${tracker}`,
      });

      if (allowed) {
        this.captureRateLimitTelemetry({
          req,
          identity,
          blocked: false,
          limit: execution.limit,
          windowSec: Math.max(1, Math.ceil(execution.ttl / 1000)),
          kind: execution.kind,
          category: execution.category,
        });
      }

      return allowed;
    } catch (error) {
      if (error instanceof SharedThrottlerStorageUnavailableError) {
        this.logger.error(
          `rate_limit_storage_unavailable path=${identity.path} tracker=${identity.tracker} detail=${error.message}`,
        );
        throw new HttpException(
          {
            statusCode: 503,
            code: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
            message:
              'Storage compartilhado de rate limit indisponivel. O backend recusou operar em modo inconsistente.',
            path: identity.path,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw error;
    }
  }

  protected async getTracker(req: RequestLike): Promise<string> {
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
    const identity = this.resolveThrottleIdentity(req);
    const execution = (req.__rateLimitContext || {}) as Partial<RateLimitExecution>;

    res.header('Retry-After', String(retryAfterSec));
    res.header('RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('RateLimit-Remaining', '0');
    res.header('RateLimit-Reset', String(retryAfterSec));
    res.header('RateLimit-Policy', `${throttlerLimitDetail.limit};w=${windowSec}`);
    res.header('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('X-RateLimit-Remaining', '0');
    res.header('X-RateLimit-Reset', String(retryAfterSec));

    this.captureRateLimitTelemetry({
      req,
      identity,
      blocked: true,
      limit: throttlerLimitDetail.limit,
      windowSec,
      retryAfterSec,
      kind: execution.kind ?? 'route',
      category: execution.category,
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
        policy: execution.kind ?? 'route',
        category: execution.category,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async resolveRateLimitExecution(
    requestProps: ThrottlerRequest,
    identity: ThrottleIdentity,
  ): Promise<RateLimitExecution | null> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const criticalAction = this.reflector.getAllAndOverride<CriticalRateLimitAction | undefined>(
      CRITICAL_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (criticalAction) {
      const criticalPolicy = await this.securityRuntimeConfigService.getCriticalRateLimitPolicy();
      return {
        kind: 'critical',
        category: criticalAction,
        tracker: this.resolveCriticalTracker(req),
        keyPrefix: `critical:${criticalAction}`,
        limit: this.resolveCriticalLimit(criticalAction, criticalPolicy),
        ttl: criticalPolicy.windowMinutes * 60000,
      };
    }

    const moduleLimit = this.toPositiveNumber(throttler?.limit, requestProps.limit);
    const moduleTtl = this.toPositiveNumber(throttler?.ttl, requestProps.ttl);
    const routeLimit = this.toPositiveNumber(requestProps.limit, moduleLimit);
    const routeTtl = this.toPositiveNumber(requestProps.ttl, moduleTtl);
    const hasExplicitRouteConfig = routeLimit !== moduleLimit || routeTtl !== moduleTtl;

    if (hasExplicitRouteConfig) {
      return {
        kind: 'route',
        tracker: identity.tracker,
        keyPrefix: `route:${context.getClass().name}:${context.getHandler().name}`,
        limit: routeLimit,
        ttl: routeTtl,
      };
    }

    const globalPolicy = await this.securityRuntimeConfigService.getGlobalRateLimitPolicy();
    if (!globalPolicy.enabled) {
      return null;
    }

    return {
      kind: 'global',
      tracker: identity.tracker,
      keyPrefix: 'global',
      limit: globalPolicy.requests,
      ttl: globalPolicy.windowMinutes * 60000,
    };
  }

  private resolveCriticalLimit(
    action: CriticalRateLimitAction,
    policy: Awaited<ReturnType<SecurityRuntimeConfigService['getCriticalRateLimitPolicy']>>,
  ): number {
    switch (action) {
      case 'backup':
        return policy.backupPerHour;
      case 'restore':
        return policy.restorePerHour;
      case 'update':
        return policy.updatePerHour;
      default:
        return policy.updatePerHour;
    }
  }

  private resolveCriticalTracker(req: RequestLike): string {
    const principal = this.resolvePrincipalIdentity(req);
    const tenantId = principal.tenantId || 'global';
    const userId = principal.userId || 'anonymous';
    const clientIp = this.resolveClientIp(req);
    return `tenant:${tenantId}:user:${userId}:ip:${clientIp}`;
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

    this.logger.warn(
      `rate_limit_blocked kind=${data.kind} category=${data.category || 'none'} path=${data.identity.path} tracker=${data.identity.tracker} limit=${data.limit} windowSec=${data.windowSec} retryAfterSec=${data.retryAfterSec || 0}`,
    );

    this.systemTelemetryService.recordSecurityEvent({
      type: 'rate_limited',
      request: data.req,
      route: data.identity.path,
      ip: data.identity.clientIp,
      statusCode: 429,
    });

    let shouldAudit = true;
    try {
      shouldAudit = await this.rateLimitMetricsService.shouldEmitBlockedAudit({
        tenantId,
        scope: data.identity.scope,
        path: data.identity.path,
        tracker: data.identity.tracker,
        method: this.resolveRequestMethod(data.req),
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao aplicar dedupe de auditoria de rate limit; evento sera registrado. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!shouldAudit) {
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
          kind: data.kind,
          category: data.category ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar auditoria de bloqueio de rate limit. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private resolveThrottleIdentity(req: RequestLike): ThrottleIdentity {
    const path = this.getRequestPath(req);
    const clientIp = this.resolveClientIp(req);

    const principal = this.resolvePrincipalIdentity(req);
    const tenantId = principal.tenantId;
    const apiKeyId = principal.apiKeyId;

    if (apiKeyId) {
      return {
        scope: 'api-key',
        tracker: `tenant:${tenantId || 'global'}:api-key:${apiKeyId}`,
        path,
        clientIp,
      };
    }

    const userId = principal.userId;
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

  private resolveTenantId(req: RequestLike): string | null {
    return this.normalizeText(req?.apiKey?.tenantId || req?.user?.tenantId || req?.tenantId);
  }

  private resolvePrincipalIdentity(req: RequestLike): PrincipalIdentity {
    const fromRequest = {
      userId: this.normalizeText(req?.user?.id || req?.user?.sub),
      tenantId: this.resolveTenantId(req),
      apiKeyId: this.normalizeText(req?.apiKey?.id || req?.user?.apiKeyId || req?.auth?.apiKeyId),
    };

    if (fromRequest.userId || fromRequest.tenantId || fromRequest.apiKeyId) {
      return fromRequest;
    }

    const token = this.extractBearerToken(req);
    if (!token) {
      return fromRequest;
    }

    const payload = this.verifyJwtPayload(token);
    if (payload) {
      const userId = this.normalizeText(payload.sub);
      const tenantId = this.normalizeText(payload.tenantId);
      const apiKeyId = this.normalizeText(payload.apiKeyId);
      return {
        userId,
        tenantId,
        apiKeyId,
      };
    }

    return fromRequest;
  }

  private extractBearerToken(req: RequestLike): string | null {
    const authorizationHeader = req?.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer') {
      return null;
    }

    const normalizedToken = (token || '').trim();
    return normalizedToken.length > 0 ? normalizedToken : null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      return typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private verifyJwtPayload(token: string): VerifiedJwtPayload | null {
    const decodedPayload = this.decodeJwtPayload(token);
    if (!decodedPayload) {
      return null;
    }

    const exp = decodedPayload.exp;
    if (typeof exp === 'number' && Number.isFinite(exp) && exp * 1000 <= Date.now()) {
      return null;
    }

    if (!this.jwtVerifier || !this.jwtSecret) {
      if (!this.hasLoggedMissingJwtSecret) {
        this.logger.warn(
          'JWT_SECRET ausente para validacao de identidade no throttler; guard usara fallback por IP para tokens sem principal autenticado.',
        );
        this.hasLoggedMissingJwtSecret = true;
      }
      return null;
    }

    try {
      const payload = this.jwtVerifier.verify<VerifiedJwtPayload>(token, {
        secret: this.jwtSecret,
      });
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }

  private resolveAuthTarget(path: string, req: RequestLike): string | null {
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

  private getRequestPath(req: RequestLike): string {
    const rawPath =
      this.normalizeText(req?.originalUrl || req?.url || req?.path || req?.route?.path) || '/';
    const [pathWithoutQuery] = rawPath.split('?');
    return pathWithoutQuery.toLowerCase();
  }

  private resolveRequestMethod(req: RequestLike): string {
    const method = this.normalizeText(req?.method);
    return method ? method.toUpperCase() : 'UNKNOWN';
  }

  private resolveUserAgent(req: RequestLike): string | undefined {
    const header = req?.headers?.['user-agent'];
    const userAgent = Array.isArray(header) ? header[0] : header;

    if (typeof userAgent !== 'string') {
      return undefined;
    }

    const normalized = userAgent.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private resolveClientIp(req: RequestLike): string {
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

  private normalizeOpaqueString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
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
}
