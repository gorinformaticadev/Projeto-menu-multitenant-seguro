import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SecurityThrottlerGuard } from './security-throttler.guard';
import {
  CRITICAL_RATE_LIMIT_KEY,
  CriticalRateLimitAction,
} from '../decorators/critical-rate-limit.decorator';
import { SharedThrottlerStorageUnavailableError } from '../services/redis-throttler.storage';

type InMemoryThrottleState = {
  totalHits: number;
  expiresAt: number;
  blockedUntil: number;
};

const createTestStorage = () => {
  const states = new Map<string, InMemoryThrottleState>();

  return {
    increment: jest.fn(
      async (
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName?: string,
      ) => {
        const now = Date.now();
        const effectiveBlockDuration = Number.isFinite(blockDuration) && blockDuration > 0 ? blockDuration : ttl;
        const storageKey = throttlerName ? `${throttlerName}:${key}` : key;
        const existing = states.get(storageKey);
        const baseState: InMemoryThrottleState =
          !existing || existing.expiresAt <= now
            ? {
                totalHits: 0,
                expiresAt: now + ttl,
                blockedUntil: 0,
              }
            : existing;

        if (baseState.blockedUntil > now) {
          const timeToBlockExpire = Math.ceil((baseState.blockedUntil - now) / 1000);
          const timeToExpire = Math.max(0, Math.ceil((baseState.expiresAt - now) / 1000));
          states.set(storageKey, baseState);
          return {
            totalHits: baseState.totalHits,
            timeToExpire,
            isBlocked: true,
            timeToBlockExpire,
          };
        }

        const nextHits = baseState.totalHits + 1;
        const isBlocked = nextHits > limit;
        const nextState: InMemoryThrottleState = {
          totalHits: nextHits,
          expiresAt: baseState.expiresAt,
          blockedUntil: isBlocked ? now + effectiveBlockDuration : 0,
        };
        states.set(storageKey, nextState);

        return {
          totalHits: nextState.totalHits,
          timeToExpire: Math.max(0, Math.ceil((nextState.expiresAt - now) / 1000)),
          isBlocked,
          timeToBlockExpire: isBlocked
            ? Math.max(1, Math.ceil((nextState.blockedUntil - now) / 1000))
            : 0,
        };
      },
    ),
  };
};

const createHttpContext = (
  path: string,
  options?: {
    ip?: string;
    method?: string;
    user?: Record<string, any>;
    criticalAction?: CriticalRateLimitAction;
    authorization?: string;
  },
) => {
  const req: Record<string, any> = {
    originalUrl: path,
    url: path,
    path,
    method: options?.method ?? 'GET',
    ip: options?.ip ?? '10.0.0.10',
    user: options?.user,
    headers: {
      'user-agent': 'jest',
      ...(options?.authorization ? { authorization: options.authorization } : {}),
    },
  };

  const resHeaders: Record<string, string | number> = {};
  const res = {
    header: jest.fn((name: string, value: string | number) => {
      resHeaders[name] = value;
      return res;
    }),
  };

  const handler = function throttledHandler() {
    return undefined;
  };
  const classRef = class TestController {};

  if (options?.criticalAction) {
    Reflect.defineMetadata(CRITICAL_RATE_LIMIT_KEY, options.criticalAction, handler);
  }

  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getClass: () => classRef,
    getHandler: () => handler,
  };

  return { context, req, res, resHeaders };
};

const createRequestProps = (
  context: any,
  options?: {
    limit?: number;
    ttl?: number;
    moduleLimit?: number;
    moduleTtl?: number;
  },
) => {
  const ttl = options?.ttl ?? 60000;
  const limit = options?.limit ?? 300;
  const moduleLimit = options?.moduleLimit ?? 300;
  const moduleTtl = options?.moduleTtl ?? 60000;

  return {
    context,
    limit,
    ttl,
    blockDuration: ttl,
    throttler: {
      name: 'default',
      limit: moduleLimit,
      ttl: moduleTtl,
    },
    getTracker: async (req: Record<string, any>) => `ip:${req.ip}`,
    generateKey: (_context: any, tracker: string, name: string) => `${name}:${tracker}`,
  };
};

describe('SecurityThrottlerGuard runtime enforcement', () => {
  const options = [{ name: 'default', ttl: 60000, limit: 300 }] as any;
  const securityRuntimeConfigService = {
    getGlobalRateLimitPolicy: jest.fn(),
    getCriticalRateLimitPolicy: jest.fn(),
  };
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const rateLimitMetricsService = {
    record: jest.fn().mockResolvedValue(undefined),
    shouldEmitBlockedAudit: jest.fn().mockResolvedValue(true),
  };
  const systemTelemetryService = {
    recordSecurityEvent: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const runtimePressureService = {
    getSnapshot: jest.fn(),
  };
  const jwtSigner = new JwtService({ secret: 'jwt-secret' });

  const createGuard = (storage: any = createTestStorage()) =>
    new SecurityThrottlerGuard(
      options,
      storage,
      new Reflector(),
      securityRuntimeConfigService as any,
      auditService as any,
      rateLimitMetricsService as any,
      systemTelemetryService as any,
      configService as any,
      runtimePressureService as any,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => (key === 'JWT_SECRET' ? 'jwt-secret' : undefined));
    securityRuntimeConfigService.getGlobalRateLimitPolicy.mockResolvedValue({
      source: 'security_config',
      enabled: true,
      requests: 2,
      windowMinutes: 1,
      environment: 'test',
    });
    securityRuntimeConfigService.getCriticalRateLimitPolicy.mockResolvedValue({
      source: 'security_config',
      windowMinutes: 60,
      backupPerHour: 1,
      restorePerHour: 1,
      updatePerHour: 1,
    });
    runtimePressureService.getSnapshot.mockReturnValue({
      eventLoopLagP95Ms: 10,
      eventLoopLagP99Ms: 20,
      eventLoopLagMaxMs: 25,
      eventLoopUtilization: 0.2,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 150,
      gcPauseP95Ms: 0,
      gcPauseMaxMs: 0,
      gcEventsRecent: 0,
      queueDepth: 0,
      activeIsolatedRequests: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    });
  });

  it('applies the configured global limit across different routes for the same identity', async () => {
    const guard = createGuard();
    await guard.onModuleInit();

    const first = createHttpContext('/api/orders', { ip: '10.0.0.20' });
    const second = createHttpContext('/api/profile', { ip: '10.0.0.20' });
    const third = createHttpContext('/api/dashboard', { ip: '10.0.0.20' });

    await expect((guard as any).handleRequest(createRequestProps(first.context))).resolves.toBe(true);
    await expect((guard as any).handleRequest(createRequestProps(second.context))).resolves.toBe(true);
    await expect((guard as any).handleRequest(createRequestProps(third.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        policy: 'global',
      }),
    });
  });

  it('picks up a changed global policy immediately without restart', async () => {
    const guard = createGuard();
    await guard.onModuleInit();

    const firstIdentity = createHttpContext('/api/orders', { ip: '10.0.0.30' });
    await expect((guard as any).handleRequest(createRequestProps(firstIdentity.context))).resolves.toBe(
      true,
    );
    await expect((guard as any).handleRequest(createRequestProps(firstIdentity.context))).resolves.toBe(
      true,
    );

    securityRuntimeConfigService.getGlobalRateLimitPolicy.mockResolvedValue({
      source: 'security_config',
      enabled: true,
      requests: 1,
      windowMinutes: 1,
      environment: 'test',
    });

    const secondIdentity = createHttpContext('/api/orders', { ip: '10.0.0.31' });
    await expect((guard as any).handleRequest(createRequestProps(secondIdentity.context))).resolves.toBe(
      true,
    );
    await expect((guard as any).handleRequest(createRequestProps(secondIdentity.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        policy: 'global',
      }),
    });
  });

  it('shares the same critical backup quota across equivalent routes', async () => {
    const guard = createGuard();
    await guard.onModuleInit();

    const user = {
      id: 'user-1',
      tenantId: 'tenant-1',
    };
    const first = createHttpContext('/api/backups', {
      method: 'POST',
      user,
      criticalAction: 'backup',
    });
    const second = createHttpContext('/api/backup/create', {
      method: 'POST',
      user,
      criticalAction: 'backup',
    });

    await expect((guard as any).handleRequest(createRequestProps(first.context))).resolves.toBe(true);
    await expect((guard as any).handleRequest(createRequestProps(second.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        policy: 'critical',
        category: 'backup',
      }),
    });
  });

  it('shares the same critical update quota across update controllers', async () => {
    const guard = createGuard();
    await guard.onModuleInit();

    const user = {
      id: 'user-1',
      tenantId: 'tenant-1',
    };
    const first = createHttpContext('/api/update/execute', {
      method: 'POST',
      user,
      criticalAction: 'update',
    });
    const second = createHttpContext('/api/system/update/run', {
      method: 'POST',
      user,
      criticalAction: 'update',
    });

    await expect((guard as any).handleRequest(createRequestProps(first.context))).resolves.toBe(true);
    await expect((guard as any).handleRequest(createRequestProps(second.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        policy: 'critical',
        category: 'update',
      }),
    });
  });

  it('returns an explicit 503 when distributed rate limit storage is unavailable in strict mode', async () => {
    const storage = {
      increment: jest.fn(async () => {
        throw new SharedThrottlerStorageUnavailableError('redis offline');
      }),
    };
    const guard = createGuard(storage);
    await guard.onModuleInit();

    const context = createHttpContext('/api/orders', { ip: '10.0.0.40' });

    await expect((guard as any).handleRequest(createRequestProps(context.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 503,
        code: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
      }),
    });
  });

  it('uses a bearer payload only after signature verification', async () => {
    const guard = createGuard();
    const signedToken = jwtSigner.sign({
      sub: 'user-verified',
      tenantId: 'tenant-verified',
      apiKeyId: null,
    });

    const context = createHttpContext('/api/orders', {
      ip: '10.0.0.50',
      authorization: `Bearer ${signedToken}`,
    });

    const identity = (guard as any).resolveThrottleIdentity(context.req);
    expect(identity.scope).toBe('tenant-user');
    expect(identity.tracker).toBe('tenant:tenant-verified:user:user-verified');
  });

  it('falls back to ip when bearer payload is not signed with the configured secret', async () => {
    const guard = createGuard();
    const forgedToken = new JwtService({ secret: 'wrong-secret' }).sign({
      sub: 'forged-user',
      tenantId: 'forged-tenant',
    });

    const context = createHttpContext('/api/orders', {
      ip: '10.0.0.51',
      authorization: `Bearer ${forgedToken}`,
    });

    const identity = (guard as any).resolveThrottleIdentity(context.req);
    expect(identity.scope).toBe('ip');
    expect(identity.tracker).toBe('ip:10.0.0.51');
  });

  it('shrinks global limits adaptively under runtime pressure on protected routes', async () => {
    const guard = createGuard();
    await guard.onModuleInit();
    runtimePressureService.getSnapshot.mockReturnValue({
      eventLoopLagP95Ms: 180,
      eventLoopLagP99Ms: 320,
      eventLoopLagMaxMs: 420,
      eventLoopUtilization: 0.96,
      heapUsedRatio: 0.9,
      recentApiLatencyMs: 1900,
      gcPauseP95Ms: 140,
      gcPauseMaxMs: 280,
      gcEventsRecent: 4,
      queueDepth: 4,
      activeIsolatedRequests: 2,
      pressureScore: 2.7,
      consecutiveBreaches: 2,
      adaptiveThrottleFactor: 0.5,
      cause: 'cpu',
      overloaded: true,
    });

    const first = createHttpContext('/api/system/dashboard', { ip: '10.0.0.70' });
    const second = createHttpContext('/api/system/dashboard', { ip: '10.0.0.70' });

    await expect((guard as any).handleRequest(createRequestProps(first.context))).resolves.toBe(true);
    await expect((guard as any).handleRequest(createRequestProps(second.context))).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        policy: 'global',
        adaptiveFactor: 0.5,
        pressureCause: 'cpu',
      }),
    });
    expect(second.resHeaders['X-RateLimit-Adaptive-Factor']).toBe('0.5');
    expect(second.resHeaders['X-RateLimit-Pressure-Cause']).toBe('cpu');
  });
});
