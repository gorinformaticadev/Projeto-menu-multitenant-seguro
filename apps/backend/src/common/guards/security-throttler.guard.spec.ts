import { Reflector } from '@nestjs/core';
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
      async (key: string, ttl: number, limit: number, blockDuration: number) => {
        const now = Date.now();
        const effectiveBlockDuration = Number.isFinite(blockDuration) && blockDuration > 0 ? blockDuration : ttl;
        const existing = states.get(key);
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
          states.set(key, baseState);
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
        states.set(key, nextState);

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

  const createGuard = (storage: any = createTestStorage()) =>
    new SecurityThrottlerGuard(
      options,
      storage,
      new Reflector(),
      securityRuntimeConfigService as any,
      auditService as any,
      rateLimitMetricsService as any,
      systemTelemetryService as any,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
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
});
