import { NotificationService } from './notification.service';

describe('NotificationService system notifications', () => {
  const prismaMock = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const createService = () => new NotificationService(prismaMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates persisted notification for allowlisted system action', async () => {
    const service = createService();
    const createdAt = new Date('2026-03-06T12:00:00.000Z');
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      type: 'SYSTEM_ALERT',
      severity: 'warning',
      title: 'Atualizacao iniciada',
      body: 'Atualizacao iniciada',
      message: 'Atualizacao iniciada',
      data: { action: 'UPDATE_STARTED' },
      createdAt,
      isRead: false,
      readAt: null,
      targetRole: 'SUPER_ADMIN',
      audience: 'super_admin',
    });

    const result = await service.emitSystemAlert({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      body: 'Atualizacao iniciada',
      data: {
        token: 'secret-token',
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=abc',
          'x-maintenance-bypass': 'bypass-secret',
        },
        stderr: 'Error: token=abc path=/opt/app/shared/.env.snapshot',
      },
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    const payload = prismaMock.notification.create.mock.calls[0][0].data;
    expect(payload.targetRole).toBe('SUPER_ADMIN');
    expect(payload.severity).toBe('warning');
    expect(payload.data.token).toBe('[redacted]');
    expect(payload.data.headers.authorization).toBe('[redacted]');
    expect(payload.data.headers.cookie).toBe('[redacted]');
    expect(payload.data.headers['x-maintenance-bypass']).toBe('[redacted]');
    expect(String(payload.data.stderr)).toContain('[redacted]');
    expect(String(payload.data.stderr)).toContain('[path-redacted]');
    expect(result).toMatchObject({
      id: 'notif-1',
      severity: 'warning',
      isRead: false,
    });
  });

  it('ignores non-allowlisted action to avoid noisy notifications', async () => {
    const service = createService();

    const result = await service.emitSystemAlert({
      action: 'BACKUP_FAILED',
      severity: 'critical',
      body: 'backup failed',
    });

    expect(result).toBeNull();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('does not throw when notification persistence fails', async () => {
    const service = createService();
    prismaMock.notification.create.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.emitSystemAlert({
        action: 'UPDATE_FAILED',
        severity: 'critical',
        body: 'falha',
      }),
    ).resolves.toBeNull();
  });

  it('caps list pagination with default 20 and maximum 100', async () => {
    const service = createService();
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);

    const first = await service.list({
      targetRole: 'SUPER_ADMIN',
    });

    expect(first.limit).toBe(20);
    expect(prismaMock.notification.findMany.mock.calls[0][0].take).toBe(20);

    const second = await service.list({
      targetRole: 'SUPER_ADMIN',
      limit: 100000,
    });

    expect(second.limit).toBe(100);
    expect(prismaMock.notification.findMany.mock.calls[1][0].take).toBe(100);
  });

  it('marks notification as read only inside SUPER_ADMIN scope', async () => {
    const service = createService();
    const now = new Date('2026-03-06T12:05:00.000Z');
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'notif-9',
      type: 'SYSTEM_ALERT',
      severity: 'critical',
      title: 'Atualizacao falhou',
      body: 'falha',
      message: 'falha',
      data: { action: 'UPDATE_FAILED' },
      createdAt: now,
      isRead: true,
      readAt: now,
      targetRole: 'SUPER_ADMIN',
      audience: 'super_admin',
    });

    const result = await service.markSystemNotificationAsRead('notif-9', {
      role: 'SUPER_ADMIN',
      userId: 'admin-1',
    });

    expect(prismaMock.notification.updateMany).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'notif-9',
      isRead: true,
    });
  });

  it('keeps read-all idempotent across repeated calls', async () => {
    const service = createService();
    prismaMock.notification.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.markAllSystemNotificationsAsRead({
      role: 'SUPER_ADMIN',
    });
    const second = await service.markAllSystemNotificationsAsRead({
      role: 'SUPER_ADMIN',
    });

    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledTimes(2);
  });

  it('uses the same target scope for list and unread-count', async () => {
    const service = createService();
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);

    await service.list({
      targetRole: 'SUPER_ADMIN',
      targetUserId: 'admin-1',
    });
    const listUnreadWhere = prismaMock.notification.count.mock.calls[1][0].where;

    await service.getUnreadCount({
      targetRole: 'SUPER_ADMIN',
      targetUserId: 'admin-1',
    });
    const unreadCountWhere = prismaMock.notification.count.mock.calls[2][0].where;

    expect(unreadCountWhere).toEqual(listUnreadWhere);
  });
});
