import { SystemDataRetentionService } from './system-data-retention.service';

describe('SystemDataRetentionService', () => {
  const prismaMock = {
    auditLog: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const cronServiceMock = {
    register: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const createService = () =>
    new SystemDataRetentionService(
      prismaMock as any,
      cronServiceMock as any,
      auditServiceMock as any,
    );

  const previousAuditRetention = process.env.AUDIT_LOG_RETENTION_DAYS;
  const previousNotificationRetention = process.env.NOTIFICATION_READ_RETENTION_DAYS;
  const previousRetentionDeleteLimit = process.env.SYSTEM_RETENTION_DELETE_LIMIT;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    delete process.env.NOTIFICATION_READ_RETENTION_DAYS;
    delete process.env.SYSTEM_RETENTION_DELETE_LIMIT;
  });

  afterAll(() => {
    if (previousAuditRetention === undefined) {
      delete process.env.AUDIT_LOG_RETENTION_DAYS;
    } else {
      process.env.AUDIT_LOG_RETENTION_DAYS = previousAuditRetention;
    }

    if (previousNotificationRetention === undefined) {
      delete process.env.NOTIFICATION_READ_RETENTION_DAYS;
    } else {
      process.env.NOTIFICATION_READ_RETENTION_DAYS = previousNotificationRetention;
    }

    if (previousRetentionDeleteLimit === undefined) {
      delete process.env.SYSTEM_RETENTION_DELETE_LIMIT;
    } else {
      process.env.SYSTEM_RETENTION_DELETE_LIMIT = previousRetentionDeleteLimit;
    }
  });

  it('registers system_data_retention cron job on module init', async () => {
    const service = createService();

    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledTimes(1);
    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.system_data_retention',
      '30 3 * * *',
      expect.any(Function),
      expect.objectContaining({
        name: 'system_data_retention',
        origin: 'core',
      }),
    );
  });

  it('runs cleanup with defaults (180/30) and applies notification fallback by createdAt when readAt is null', async () => {
    const service = createService();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

    prismaMock.auditLog.findMany.mockResolvedValue([
      { id: 'a1' },
      { id: 'a2' },
    ]);
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 12 });
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'n1' },
      { id: 'n2' },
    ]);
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 4 });

    const result = await service.runRetentionCleanup('manual');

    const expectedAuditCutoff = new Date('2025-09-11T12:00:00.000Z');
    const expectedNotificationCutoff = new Date('2026-02-08T12:00:00.000Z');

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expectedAuditCutoff,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });
    expect(prismaMock.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['a1', 'a2'],
        },
      },
    });
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: {
        isRead: true,
        OR: [
          {
            readAt: {
              lt: expectedNotificationCutoff,
            },
          },
          {
            readAt: null,
            createdAt: {
              lt: expectedNotificationCutoff,
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['n1', 'n2'],
        },
      },
    });

    expect(result.deletedAuditLogs).toBe(12);
    expect(result.deletedNotifications).toBe(4);
    expect(result.auditRetentionDays).toBe(180);
    expect(result.notificationRetentionDays).toBe(30);
    expect(result.maxDeletePerRun).toBe(5000);
    expect(result.errors).toEqual([]);
    expect(auditServiceMock.log).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('continues when one cleanup fails and emits audit only on error', async () => {
    const service = createService();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

    process.env.AUDIT_LOG_RETENTION_DAYS = '200';
    process.env.NOTIFICATION_READ_RETENTION_DAYS = '45';
    process.env.SYSTEM_RETENTION_DELETE_LIMIT = '1500';

    prismaMock.auditLog.findMany.mockRejectedValue(new Error('audit delete unavailable'));
    prismaMock.notification.findMany.mockResolvedValue([{ id: 'n3' }]);
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 3 });
    auditServiceMock.log.mockResolvedValue(null);

    const result = await service.runRetentionCleanup('cron');

    expect(result.deletedAuditLogs).toBe(0);
    expect(result.deletedNotifications).toBe(3);
    expect(result.auditRetentionDays).toBe(200);
    expect(result.notificationRetentionDays).toBe(45);
    expect(result.maxDeletePerRun).toBe(1500);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('audit');

    expect(auditServiceMock.log).toHaveBeenCalledTimes(1);
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYSTEM_DATA_RETENTION_FAILED',
        severity: 'warning',
        metadata: expect.objectContaining({
          source: 'cron',
          auditRetentionDays: 200,
          notificationRetentionDays: 45,
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('uses configured delete safety limit when selecting candidates', async () => {
    const service = createService();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

    process.env.SYSTEM_RETENTION_DELETE_LIMIT = '120';
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.notification.findMany.mockResolvedValue([]);

    const result = await service.runRetentionCleanup('manual');

    expect(prismaMock.auditLog.findMany.mock.calls[0][0].take).toBe(120);
    expect(prismaMock.notification.findMany.mock.calls[0][0].take).toBe(120);
    expect(result.maxDeletePerRun).toBe(120);

    jest.useRealTimers();
  });
});
