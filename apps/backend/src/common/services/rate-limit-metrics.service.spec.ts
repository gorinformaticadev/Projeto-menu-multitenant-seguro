import { Logger } from '@nestjs/common';
import { RateLimitMetricsService } from './rate-limit-metrics.service';

type RedisHandler = (error?: Error) => void;

const redisInstances: MockRedis[] = [];

class MockRedisMulti {
  hincrby = jest.fn().mockReturnThis();
  zincrby = jest.fn().mockReturnThis();
  expire = jest.fn().mockReturnThis();
  hgetall = jest.fn().mockReturnThis();
  zrevrange = jest.fn().mockReturnThis();
  exec = jest.fn(async () => []);
}

class MockRedis {
  status = 'wait';
  handlers: Record<string, RedisHandler> = {};
  multiInstance = new MockRedisMulti();
  connect = jest.fn(async () => {
    this.status = 'ready';
    this.handlers.ready?.();
  });
  multi = jest.fn(() => this.multiInstance);
  set = jest.fn(async () => 'OK');

  on(event: string, handler: RedisHandler) {
    this.handlers[event] = handler;
    return this;
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const instance = new MockRedis();
    redisInstances.push(instance);
    return instance;
  }),
}));

describe('RateLimitMetricsService', () => {
  const originalEnv = { ...process.env };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RATE_LIMIT_REDIS_ENABLED: 'false',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6379',
      RATE_LIMIT_METRICS_RETENTION_HOURS: '24',
      RATE_LIMIT_METRICS_MAX_QUERY_HOURS: '24',
      RATE_LIMIT_BLOCK_AUDIT_COOLDOWN_MS: '50',
      RATE_LIMIT_BLOCK_AUDIT_DEDUP_MAX: '100',
      RATE_LIMIT_REDIS_RETRY_COOLDOWN_MS: '15000',
    };
    redisInstances.length = 0;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.useRealTimers();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('aggregates hits and blocked requests by tenant in memory mode', async () => {
    const service = new RateLimitMetricsService();

    await service.record({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users?include=all',
      blocked: false,
    });
    await service.record({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users',
      blocked: true,
    });
    await service.record({
      tenantId: 'tenant-b',
      scope: 'ip',
      path: '/api/auth/login',
      blocked: true,
    });

    const globalStats = await service.getStats({ hours: 1, top: 10 });

    expect(globalStats.totals.hits).toBe(3);
    expect(globalStats.totals.blocked).toBe(2);
    expect(globalStats.topEndpoints).toContainEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        path: '/api/users',
        hits: 2,
      }),
    );

    const tenantStats = await service.getStats({ hours: 1, tenantId: 'tenant-a', top: 10 });

    expect(tenantStats.totals.hits).toBe(2);
    expect(tenantStats.totals.blocked).toBe(1);
    expect(tenantStats.byTenant).toContainEqual(
      expect.objectContaining({
        key: 'tenant-a',
        hits: 2,
        blocked: 1,
      }),
    );
    expect(tenantStats.topBlockedEndpoints).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-a',
        path: '/api/users',
        hits: 1,
      }),
    ]);
  });

  it('clamps query window to configured max hours', async () => {
    process.env.RATE_LIMIT_METRICS_MAX_QUERY_HOURS = '2';

    const service = new RateLimitMetricsService();
    const stats = await service.getStats({ hours: 99 });

    expect(stats.windowHours).toBe(2);
  });

  it('deduplicates blocked audit emission in memory fallback mode', async () => {
    const service = new RateLimitMetricsService();

    const first = await service.shouldEmitBlockedAudit({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users?include=all',
      tracker: 'tenant:tenant-a:user:user-1',
      method: 'post',
    });

    const second = await service.shouldEmitBlockedAudit({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users',
      tracker: 'tenant:tenant-a:user:user-1',
      method: 'POST',
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('allows blocked audit after cooldown expires', async () => {
    process.env.RATE_LIMIT_BLOCK_AUDIT_COOLDOWN_MS = '1';

    const service = new RateLimitMetricsService();

    const first = await service.shouldEmitBlockedAudit({
      tenantId: 'tenant-a',
      scope: 'ip',
      path: '/api/auth/login',
      tracker: 'ip:10.0.0.1:target:abc',
      method: 'POST',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await service.shouldEmitBlockedAudit({
      tenantId: 'tenant-a',
      scope: 'ip',
      path: '/api/auth/login',
      tracker: 'ip:10.0.0.1:target:abc',
      method: 'POST',
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('avoids repeated redis reconnect attempts while fallback cooldown is active', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T17:30:00.000Z'));
    process.env.RATE_LIMIT_REDIS_ENABLED = 'true';

    const service = new RateLimitMetricsService();
    const redis = redisInstances[0];

    redis.connect.mockImplementation(async () => {
      redis.status = 'end';
      throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
    });

    await service.record({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users',
      blocked: false,
    });

    await service.record({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users',
      blocked: true,
    });

    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const stats = await service.getStats({ hours: 1, tenantId: 'tenant-a', top: 10 });
    expect(stats.totals.hits).toBe(2);
    expect(stats.totals.blocked).toBe(1);
    expect(redis.connect).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-03-14T17:30:16.000Z'));

    await service.record({
      tenantId: 'tenant-a',
      scope: 'tenant-user',
      path: '/api/users',
      blocked: false,
    });

    expect(redis.connect).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
