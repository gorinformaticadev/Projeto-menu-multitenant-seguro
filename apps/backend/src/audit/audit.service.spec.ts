import { AuditService } from './audit.service';

describe('AuditService rate limit observability', () => {
  const prismaMock = {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const rateLimitMetricsServiceMock = {
    getStats: jest.fn(),
  };

  const createService = () =>
    new AuditService(prismaMock as any, rateLimitMetricsServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates rate limit stats query to metrics service', async () => {
    const service = createService();
    const expected = {
      windowHours: 12,
      totals: { hits: 10, blocked: 2, blockRate: 20 },
    };
    rateLimitMetricsServiceMock.getStats.mockResolvedValue(expected);

    const result = await service.getRateLimitStats({ hours: 12, tenantId: 'tenant-a', top: 5 });

    expect(rateLimitMetricsServiceMock.getStats).toHaveBeenCalledWith({
      hours: 12,
      tenantId: 'tenant-a',
      top: 5,
    });
    expect(result).toEqual(expected);
  });

  it('returns blocked events filtered by tenant and parses details payload', async () => {
    const service = createService();
    const createdAt = new Date();

    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: '1',
        action: 'RATE_LIMIT_BLOCKED',
        userId: 'user-1',
        tenantId: 'tenant-a',
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
        details: '{"scope":"tenant-user","path":"/api/users"}',
        createdAt,
        user: null,
      },
      {
        id: '2',
        action: 'RATE_LIMIT_BLOCKED',
        userId: null,
        tenantId: 'tenant-a',
        ipAddress: '10.0.0.2',
        userAgent: 'jest',
        details: 'not-json',
        createdAt,
        user: null,
      },
    ]);
    prismaMock.auditLog.count.mockResolvedValue(2);

    const result = await service.findRateLimitBlockedEvents({
      tenantId: 'tenant-a',
      hours: 6,
      page: 1,
      limit: 10,
    });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaMock.auditLog.findMany.mock.calls[0][0];

    expect(findManyArgs.where.action).toBe('RATE_LIMIT_BLOCKED');
    expect(findManyArgs.where.tenantId).toBe('tenant-a');
    expect(findManyArgs.where.createdAt.gte).toBeInstanceOf(Date);
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(10);

    expect(result.data[0].details).toEqual({
      scope: 'tenant-user',
      path: '/api/users',
    });
    expect(result.data[1].details).toEqual({ raw: 'not-json' });
    expect(result.meta.windowHours).toBe(6);
    expect(result.meta.total).toBe(2);
  });

  it('clamps limit and hours for blocked events query', async () => {
    const service = createService();

    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const result = await service.findRateLimitBlockedEvents({
      page: -10,
      limit: 999,
      hours: 999,
    });

    const findManyArgs = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(findManyArgs.take).toBe(200);
    expect(findManyArgs.skip).toBe(0);

    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(200);
    expect(result.meta.windowHours).toBe(168);
  });
});
