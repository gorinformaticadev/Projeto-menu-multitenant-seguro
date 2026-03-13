import { NotificationsController } from './notifications.controller';

describe('NotificationsController configuration-aware contracts', () => {
  const notificationServiceMock = {
    getNotificationsToggleState: jest.fn(),
    create: jest.fn(),
    broadcast: jest.fn(),
    findForDropdown: jest.fn(),
    findMany: jest.fn(),
    countUnread: jest.fn(),
    markUserNotificationAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
  };
  const notificationGatewayMock = {
    emitNewNotification: jest.fn(),
    emitNotificationRead: jest.fn(),
    emitNotificationDeleted: jest.fn(),
  };
  const pushNotificationServiceMock = {
    getPublicKey: jest.fn(),
    saveSubscription: jest.fn(),
    removeSubscription: jest.fn(),
  };

  const createController = () =>
    new NotificationsController(
      notificationServiceMock as any,
      notificationGatewayMock as any,
      pushNotificationServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    notificationServiceMock.getNotificationsToggleState.mockResolvedValue({
      key: 'notifications.enabled',
      enabled: true,
      source: 'default',
    });
  });

  it('returns explicit configuration metadata when manual notification creation is allowed', async () => {
    const controller = createController();
    const notification = {
      id: 'notification-1',
      title: 'Atualizacao',
      description: 'Descricao',
      type: 'info',
      read: false,
      readAt: null,
      createdAt: new Date('2026-03-13T22:00:00.000Z'),
      updatedAt: new Date('2026-03-13T22:00:00.000Z'),
    };
    notificationServiceMock.create.mockResolvedValue(notification);

    const response = await controller.create(
      {
        title: 'Atualizacao',
        description: 'Descricao',
        type: 'info',
      },
      { user: { id: 'admin-1' } } as any,
    );

    expect(notificationServiceMock.create).toHaveBeenCalledTimes(1);
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(notification);
    expect(response).toEqual({
      success: true,
      notification,
      suppressed: false,
      blockReason: null,
      configuration: {
        key: 'notifications.enabled',
        enabled: true,
        source: 'default',
      },
    });
  });

  it('returns explicit suppression metadata and skips gateway emission when notifications are disabled', async () => {
    const controller = createController();
    notificationServiceMock.getNotificationsToggleState.mockResolvedValue({
      key: 'notifications.enabled',
      enabled: false,
      source: 'database',
    });

    const response = await controller.create(
      {
        title: 'Atualizacao',
        description: 'Descricao',
        type: 'info',
      },
      { user: { id: 'admin-1' } } as any,
    );

    expect(notificationServiceMock.create).not.toHaveBeenCalled();
    expect(notificationGatewayMock.emitNewNotification).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: true,
      notification: null,
      suppressed: true,
      blockReason: 'disabled_by_configuration',
      configuration: {
        key: 'notifications.enabled',
        enabled: false,
        source: 'database',
      },
    });
  });

  it('returns explicit suppression metadata for broadcast when notifications are disabled', async () => {
    const controller = createController();
    notificationServiceMock.getNotificationsToggleState.mockResolvedValue({
      key: 'notifications.enabled',
      enabled: false,
      source: 'env',
    });

    const response = await controller.broadcast(
      {
        title: 'Broadcast',
        description: 'Descricao',
        type: 'info',
        scope: 'global',
        target: 'admins_only',
      },
      { user: { id: 'admin-1' } } as any,
    );

    expect(notificationServiceMock.broadcast).not.toHaveBeenCalled();
    expect(response).toEqual({
      count: 0,
      suppressed: true,
      blockReason: 'disabled_by_configuration',
      configuration: {
        key: 'notifications.enabled',
        enabled: false,
        source: 'env',
      },
    });
  });

  it('keeps zero-count broadcast distinguishable from disabled state when notifications are enabled', async () => {
    const controller = createController();
    notificationServiceMock.broadcast.mockResolvedValue({ count: 0 });

    const response = await controller.broadcast(
      {
        title: 'Broadcast',
        description: 'Descricao',
        type: 'info',
        scope: 'global',
        target: 'admins_only',
      },
      { user: { id: 'admin-1' } } as any,
    );

    expect(notificationServiceMock.broadcast).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      count: 0,
      suppressed: false,
      blockReason: null,
      configuration: {
        key: 'notifications.enabled',
        enabled: true,
        source: 'default',
      },
    });
  });
});
