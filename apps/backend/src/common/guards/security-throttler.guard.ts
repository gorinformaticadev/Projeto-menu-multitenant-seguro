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
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { SecurityRuntimeConfigService } from '@core/security-config/security-runtime-config.service';
import { AuditService } from '../../audit/audit.service';
import { OperationalLoadSheddingService } from '../services/operational-load-shedding.service';
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
  scope?: ThrottleScope;
  burst?: boolean;
  routePolicyId?: string;
  adaptiveFactor?: number;
  pressureCause?: string;
};

type RateLimitTelemetry = {
  req: Record<string, any>;
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
    private readonly operationalLoadSheddingService: OperationalLoadSheddingService,
  ) {
    super(options, storageService, reflector);
    const rawSecret = this.configService.get<string>('JWT_SECRET');
    const normalizedSecret = this.normalizeOpaqueString(rawSecret);
    this.jwtSecret = normalizedSecret;
    this.jwtVerifier = normalizedSecret ? new JwtService({ secret: normalizedSecret }) : null;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();
    const identity = this.resolveThrottleIdentity(req);
    const adaptiveContext = this.resolveAdaptiveRateLimitContext(identity.path);
    const execution = await this.resolveRateLimitExecution(
      requestProps,
      identity,
      adaptiveContext.factor,
      adaptiveContext.cause,
    );

    if (!execution) {
      return true;
    }

    req.__rateLimitContext = execution;
    req.__rateLimitIdentityOverride = identity;

    await this.enforceAdditionalRouteLimits(requestProps, identity, adaptiveContext);

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
    const identity = (req.__rateLimitIdentityOverride ||
      this.resolveThrottleIdentity(req)) as ThrottleIdentity;
    const execution = (req.__rateLimitContext || {}) as Partial<RateLimitExecution>;

    res.header('Retry-After', String(retryAfterSec));
    res.header('RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('RateLimit-Remaining', '0');
    res.header('RateLimit-Reset', String(retryAfterSec));
    res.header('RateLimit-Policy', `${throttlerLimitDetail.limit};w=${windowSec}`);
    res.header('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.header('X-RateLimit-Remaining', '0');
    res.header('X-RateLimit-Reset', String(retryAfterSec));
    if (execution.adaptiveFactor && execution.adaptiveFactor < 1) {
      res.header('X-RateLimit-Adaptive-Factor', String(execution.adaptiveFactor));
    }
    if (execution.pressureCause) {
      res.header('X-RateLimit-Pressure-Cause', execution.pressureCause);
    }

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
        scope: execution.scope ?? identity.scope,
        burst: execution.burst === true,
        routePolicyId: execution.routePolicyId ?? null,
        adaptiveFactor: execution.adaptiveFactor ?? 1,
        pressureCause: execution.pressureCause ?? null,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async enforceAdditionalRouteLimits(
    requestProps: ThrottlerRequest,
    identity: ThrottleIdentity,
    adaptiveContext: {
      factor: number;
      cause: string | null;
    },
  ): Promise<void> {
    const req = requestProps.context.switchToHttp().getRequest();
    const routePolicy = resolveApiRouteContractPolicy(identity.path);
    const principal = this.resolvePrincipalIdentity(req);
    const checks = this.buildAdditionalRouteLimitChecks(
      routePolicy.id,
      identity,
      principal,
      adaptiveContext.factor,
    );

    for (const check of checks) {
      const record = await this.storageService.increment(
        check.tracker,
        check.ttl,
        check.limit,
        check.ttl,
        check.throttlerName,
      );

      if (record.isBlocked) {
        req.__rateLimitContext = {
          kind: 'route',
          tracker: check.tracker,
          keyPrefix: check.throttlerName,
          limit: check.limit,
          ttl: check.ttl,
          scope: check.scope,
          routePolicyId: routePolicy.id,
          adaptiveFactor: adaptiveContext.factor,
          pressureCause: adaptiveContext.cause || undefined,
        } satisfies Partial<RateLimitExecution>;
        req.__rateLimitIdentityOverride = {
          scope: check.scope,
          tracker: check.tracker,
          path: identity.path,
          clientIp: identity.clientIp,
        } satisfies ThrottleIdentity;

        await this.throwThrottlingException(requestProps.context, {
          key: `${check.throttlerName}:${check.tracker}`,
          tracker: check.tracker,
          ttl: check.ttl,
          limit: check.limit,
          totalHits: record.totalHits,
          timeToExpire: record.timeToExpire,
          isBlocked: record.isBlocked,
          timeToBlockExpire: record.timeToBlockExpire,
        });
      }

      if (!check.burstLimit || !check.burstTtl) {
        continue;
      }

      const burstRecord = await this.storageService.increment(
        check.tracker,
        check.burstTtl,
        check.burstLimit,
        check.burstTtl,
        `${check.throttlerName}:burst`,
      );

      if (burstRecord.isBlocked) {
        req.__rateLimitContext = {
          kind: 'route',
          tracker: check.tracker,
          keyPrefix: `${check.throttlerName}:burst`,
          limit: check.burstLimit,
          ttl: check.burstTtl,
          scope: check.scope,
          burst: true,
          routePolicyId: routePolicy.id,
          adaptiveFactor: adaptiveContext.factor,
          pressureCause: adaptiveContext.cause || undefined,
        } satisfies Partial<RateLimitExecution>;
        req.__rateLimitIdentityOverride = {
          scope: check.scope,
          tracker: check.tracker,
          path: identity.path,
          clientIp: identity.clientIp,
        } satisfies ThrottleIdentity;

        await this.throwThrottlingException(requestProps.context, {
          key: `${check.throttlerName}:burst:${check.tracker}`,
          tracker: check.tracker,
          ttl: check.burstTtl,
          limit: check.burstLimit,
          totalHits: burstRecord.totalHits,
          timeToExpire: burstRecord.timeToExpire,
          isBlocked: burstRecord.isBlocked,
          timeToBlockExpire: burstRecord.timeToBlockExpire,
        });
      }
    }
  }

  private buildAdditionalRouteLimitChecks(
    routePolicyId: string,
    identity: ThrottleIdentity,
    principal: PrincipalIdentity,
    adaptiveFactor: number,
  ): Array<{
    scope: ThrottleScope;
    tracker: string;
    throttlerName: string;
    limit: number;
    ttl: number;
    burstLimit?: number;
    burstTtl?: number;
  }> {
    const routeRateLimit = resolveApiRouteContractPolicy(identity.path).rateLimit;
    const checks: Array<{
      scope: ThrottleScope;
      tracker: string;
      throttlerName: string;
      limit: number;
      ttl: number;
      burstLimit?: number;
      burstTtl?: number;
    }> = [];

    if (routeRateLimit.ip) {
      checks.push({
        scope: 'ip',
        tracker: `ip:${identity.clientIp}`,
        throttlerName: `route-policy:${routePolicyId}:ip`,
        limit: this.applyAdaptiveLimit(routeRateLimit.ip.limit, adaptiveFactor),
        ttl: routeRateLimit.ip.ttlMs,
        burstLimit:
          routeRateLimit.ip.burstLimit !== undefined
            ? this.applyAdaptiveLimit(routeRateLimit.ip.burstLimit, adaptiveFactor)
            : undefined,
        burstTtl: routeRateLimit.ip.burstTtlMs,
      });
    }

    if (routeRateLimit.user && principal.userId) {
      checks.push({
        scope: 'user',
        tracker: `user:${principal.userId}`,
        throttlerName: `route-policy:${routePolicyId}:user`,
        limit: this.applyAdaptiveLimit(routeRateLimit.user.limit, adaptiveFactor),
        ttl: routeRateLimit.user.ttlMs,
        burstLimit:
          routeRateLimit.user.burstLimit !== undefined
            ? this.applyAdaptiveLimit(routeRateLimit.user.burstLimit, adaptiveFactor)
            : undefined,
        burstTtl: routeRateLimit.user.burstTtlMs,
      });
    }

    if (routeRateLimit.tenant && principal.tenantId) {
      checks.push({
        scope: 'tenant',
        tracker: `tenant:${principal.tenantId}`,
        throttlerName: `route-policy:${routePolicyId}:tenant`,
        limit: this.applyAdaptiveLimit(routeRateLimit.tenant.limit, adaptiveFactor),
        ttl: routeRateLimit.tenant.ttlMs,
        burstLimit:
          routeRateLimit.tenant.burstLimit !== undefined
            ? this.applyAdaptiveLimit(routeRateLimit.tenant.burstLimit, adaptiveFactor)
            : undefined,
        burstTtl: routeRateLimit.tenant.burstTtlMs,
      });
    }

    if (routeRateLimit['tenant-user'] && principal.userId && principal.tenantId) {
      checks.push({
        scope: 'tenant-user',
        tracker: `tenant:${principal.tenantId}:user:${principal.userId}`,
        throttlerName: `route-policy:${routePolicyId}:tenant-user`,
        limit: this.applyAdaptiveLimit(routeRateLimit['tenant-user'].limit, adaptiveFactor),
        ttl: routeRateLimit['tenant-user'].ttlMs,
        burstLimit:
          routeRateLimit['tenant-user'].burstLimit !== undefined
            ? this.applyAdaptiveLimit(routeRateLimit['tenant-user'].burstLimit, adaptiveFactor)
            : undefined,
        burstTtl: routeRateLimit['tenant-user'].burstTtlMs,
      });
    }

    if (routeRateLimit['api-key'] && principal.apiKeyId) {
      checks.push({
        scope: 'api-key',
        tracker: `api-key:${principal.apiKeyId}`,
        throttlerName: `route-policy:${routePolicyId}:api-key`,
        limit: this.applyAdaptiveLimit(routeRateLimit['api-key'].limit, adaptiveFactor),
        ttl: routeRateLimit['api-key'].ttlMs,
        burstLimit:
          routeRateLimit['api-key'].burstLimit !== undefined
            ? this.applyAdaptiveLimit(routeRateLimit['api-key'].burstLimit, adaptiveFactor)
            : undefined,
        burstTtl: routeRateLimit['api-key'].burstTtlMs,
      });
    }

    return checks;
  }

  private async resolveRateLimitExecution(
    requestProps: ThrottlerRequest,
    identity: ThrottleIdentity,
    adaptiveFactor: number,
    pressureCause: string | null,
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
        adaptiveFactor: 1,
        pressureCause: pressureCause || undefined,
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
        limit: this.applyAdaptiveLimit(routeLimit, adaptiveFactor),
        ttl: routeTtl,
        adaptiveFactor,
        pressureCause: pressureCause || undefined,
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
      limit: this.applyAdaptiveLimit(globalPolicy.requests, adaptiveFactor),
      ttl: globalPolicy.windowMinutes * 60000,
      adaptiveFactor,
      pressureCause: pressureCause || undefined,
    };
  }

  private resolveAdaptiveRateLimitContext(path: string): {
    factor: number;
    cause: string | null;
  } {
    const routePolicy = resolveApiRouteContractPolicy(path);
    if (!routePolicy.runtime.shedOnCpuPressure) {
      return {
        factor: 1,
        cause: null,
      };
    }

    const snapshot = this.operationalLoadSheddingService.getSnapshot();
    const factor =
      snapshot.overloadedInstances > 0 || snapshot.adaptiveThrottleFactor < 1
        ? snapshot.adaptiveThrottleFactor
        : 1;

    return {
      factor,
      cause: factor < 1 ? snapshot.pressureCause : null,
    };
  }

  private applyAdaptiveLimit(baseLimit: number, adaptiveFactor: number): number {
    const normalizedBaseLimit = this.toPositiveNumber(baseLimit, 1);
    const normalizedFactor =
      Number.isFinite(adaptiveFactor) && adaptiveFactor > 0 && adaptiveFactor <= 1
        ? adaptiveFactor
        : 1;
    return Math.max(1, Math.floor(normalizedBaseLimit * normalizedFactor));
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

  private resolveCriticalTracker(req: Record<string, any>): string {
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

  private resolveThrottleIdentity(req: Record<string, any>): ThrottleIdentity {
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

  private resolveTenantId(req: Record<string, any>): string | null {
    return this.normalizeText(req?.apiKey?.tenantId || req?.user?.tenantId || req?.tenantId);
  }

  private resolvePrincipalIdentity(req: Record<string, any>): PrincipalIdentity {
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

  private extractBearerToken(req: Record<string, any>): string | null {
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

  private getRequestPath(req: Record<string, any>): string {
    const rawPath =
      this.normalizeText(req?.originalUrl || req?.url || req?.path || req?.route?.path) || '/';
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
