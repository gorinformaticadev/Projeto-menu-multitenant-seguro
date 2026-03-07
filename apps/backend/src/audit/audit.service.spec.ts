import { AuditService } from './audit.service';

describe('AuditService rate limit observability', () => {
  const prismaMock = {
    auditLog: {
      create: jest.fn(),
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

  it('does not throw when audit persistence fails', async () => {
    const service = createService();
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.log({
        action: 'UPDATE_STARTED',
        severity: 'warning',
        message: 'update started',
        metadata: { token: 'secret-token' },
      }),
    ).resolves.toBeNull();
  });

  it('persists a human-friendly message when the event does not provide one', async () => {
    const service = createService();
    prismaMock.auditLog.create.mockResolvedValueOnce({ id: 'audit-pt' });

    await service.log({
      action: 'TOKEN_REFRESHED',
      severity: 'info',
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'TOKEN_REFRESHED',
          message: 'Sessao renovada',
        }),
      }),
    );
  });

  it('filters by actor and severity and returns sanitized metadata', async () => {
    const service = createService();
    const createdAt = new Date('2026-03-06T12:00:00.000Z');

    prismaMock.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'audit-1',
        action: 'UPDATE_FAILED',
        severity: 'critical',
        actorUserId: 'user-1',
        metadata: {
          token: 'super-secret',
          nested: {
            password: '123456',
          },
        },
        details: JSON.stringify({ path: '/var/app/shared/.env' }),
        createdAt,
        user: null,
      },
    ]);
    prismaMock.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      severity: 'critical',
      actorUserId: 'user-1',
    });

    const findManyArgs = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(findManyArgs.where.severity).toBe('critical');
    expect(findManyArgs.where.OR).toEqual([{ actorUserId: 'user-1' }, { userId: 'user-1' }]);

    expect(result.data[0].metadata).toEqual({
      token: '[redacted]',
      nested: {
        password: '[redacted]',
      },
    });
    expect(result.data[0].details).toEqual({
      path: '[path-redacted]',
    });
  });

  it('returns action label and humanized message for technical audit entries', async () => {
    const service = createService();
    const createdAt = new Date('2026-03-06T12:00:00.000Z');

    prismaMock.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'audit-pt-1',
        action: 'TOKEN_REFRESHED',
        message: 'TOKEN_REFRESHED',
        severity: 'critical',
        actorUserId: 'user-1',
        metadata: {},
        details: null,
        createdAt,
        user: null,
      },
    ]);
    prismaMock.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      severity: 'critical',
    });

    expect(result.data[0].action).toBe('TOKEN_REFRESHED');
    expect(result.data[0].actionLabel).toBe('Sessao renovada');
    expect(result.data[0].message).toBe('Sessao renovada');
  });

  it('applies default and maximum limit on findAll pagination', async () => {
    const service = createService();
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const first = await service.findAll({
      page: 1,
    });
    const firstCallArgs = prismaMock.auditLog.findMany.mock.calls[0][0];

    expect(firstCallArgs.take).toBe(20);
    expect(first.meta.limit).toBe(20);

    const second = await service.findAll({
      page: 1,
      limit: 100000,
    });
    const secondCallArgs = prismaMock.auditLog.findMany.mock.calls[1][0];

    expect(secondCallArgs.take).toBe(100);
    expect(second.meta.limit).toBe(100);
  });

  it('sanitizes deep metadata and error payloads with sensitive fragments', async () => {
    const service = createService();
    const createdAt = new Date('2026-03-06T12:00:00.000Z');

    prismaMock.auditLog.findMany.mockResolvedValueOnce([
      {
        id: 'audit-2',
        action: 'UPDATE_FAILED',
        severity: 'critical',
        actorUserId: 'user-1',
        metadata: {
          envSnapshotPath: '/opt/app/shared/.env.snapshot',
          headers: {
            authorization: 'Bearer abc.def.ghi',
            'x-api-key': 'api-key-secret',
            'content-type': 'application/json',
          },
          nested: {
            lastError:
              'Database failed token=abc DATABASE_URL=postgres://user:pass@db.local:5432/app path=/opt/app/shared/.env.snapshot',
          },
        },
        details: JSON.stringify({
          secretsPath: '/etc/secrets/app.key',
          safePath: '/var/log/app/update.log',
          stderr: 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def',
        }),
        createdAt,
        user: null,
      },
    ]);
    prismaMock.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      action: 'UPDATE_FAILED',
    });

    expect(result.data[0].metadata).toMatchObject({
      envSnapshotCaptured: true,
      headers: {
        authorization: '[redacted]',
        'x-api-key': '[redacted]',
        'content-type': 'application/json',
      },
    });
    expect(String(result.data[0].metadata.nested.lastError)).toBe('[redacted]');
    expect(result.data[0].details).toMatchObject({
      secretsPath: '[redacted]',
      safePath: '[path-redacted]/update.log',
    });
    expect(String(result.data[0].details.stderr)).toContain('[redacted]');
    expect(String(result.data[0].details.stderr)).not.toContain('eyJ');
  });

  it('returns empty list when action filter is outside allowed prefixes', async () => {
    const service = createService();

    const result = await service.findAll({
      page: 1,
      limit: 10,
      action: 'AUTH_LOGIN_SUCCESS',
      allowedActionPrefixes: ['UPDATE_', 'MAINTENANCE_'],
    });

    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.count).not.toHaveBeenCalled();
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
