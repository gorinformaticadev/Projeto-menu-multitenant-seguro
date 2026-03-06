import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemNotificationsController } from './system-notifications.controller';

describe('SystemNotificationsController', () => {
  const notificationServiceMock = {
    list: jest.fn(),
    getUnreadCount: jest.fn(),
    markSystemNotificationAsRead: jest.fn(),
    markAllSystemNotificationsAsRead: jest.fn(),
  };

  const createController = () =>
    new SystemNotificationsController(notificationServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects endpoint with JWT + roles SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemNotificationsController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemNotificationsController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('parses query and delegates list to notification service', async () => {
    const controller = createController();
    notificationServiceMock.list.mockResolvedValue({
      notifications: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    await controller.list({
      page: '2',
      limit: '100000',
      isRead: 'false',
      unreadOnly: 'true',
      severity: 'critical',
    });

    expect(notificationServiceMock.list).toHaveBeenCalledTimes(1);
    expect(notificationServiceMock.list).toHaveBeenCalledWith({
      page: 2,
      limit: 100000,
      isRead: false,
      unreadOnly: true,
      severity: 'critical',
      targetRole: 'SUPER_ADMIN',
    });
  });

  it('delegates unread count query', async () => {
    const controller = createController();
    notificationServiceMock.getUnreadCount.mockResolvedValue(3);

    const response = await controller.unreadCount();

    expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledWith({
      targetRole: 'SUPER_ADMIN',
    });
    expect(response).toEqual({ count: 3 });
  });

  it('delegates mark read with actor context', async () => {
    const controller = createController();
    const req = { user: { id: 'admin-1', role: 'SUPER_ADMIN' } };
    notificationServiceMock.markSystemNotificationAsRead.mockResolvedValue({ id: 'n1' });

    const response = await controller.markRead('n1', req);

    expect(notificationServiceMock.markSystemNotificationAsRead).toHaveBeenCalledWith('n1', {
      userId: 'admin-1',
      role: 'SUPER_ADMIN',
      targetRole: 'SUPER_ADMIN',
    });
    expect(response).toEqual({
      success: true,
      notification: { id: 'n1' },
    });
  });

  it('delegates read-all operation', async () => {
    const controller = createController();
    const req = { user: { sub: 'admin-2', role: 'SUPER_ADMIN' } };
    notificationServiceMock.markAllSystemNotificationsAsRead.mockResolvedValue(8);

    const response = await controller.markAllRead(req, {});

    expect(notificationServiceMock.markAllSystemNotificationsAsRead).toHaveBeenCalledWith({
      userId: 'admin-2',
      role: 'SUPER_ADMIN',
      targetRole: 'SUPER_ADMIN',
      targetUserId: undefined,
    });
    expect(response).toEqual({
      success: true,
      count: 8,
    });
  });
});
