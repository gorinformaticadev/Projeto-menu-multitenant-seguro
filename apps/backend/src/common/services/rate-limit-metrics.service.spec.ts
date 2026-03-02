import { RateLimitMetricsService } from './rate-limit-metrics.service';

describe('RateLimitMetricsService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RATE_LIMIT_REDIS_ENABLED: 'false',
      RATE_LIMIT_METRICS_RETENTION_HOURS: '24',
      RATE_LIMIT_METRICS_MAX_QUERY_HOURS: '24',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
});
