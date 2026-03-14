import { NotificationGateway } from './notification.gateway';
import { Notification } from './notification.entity';

describe('NotificationGateway websocket toggle', () => {
  const gateways: NotificationGateway[] = [];

  const baseNotification: Notification = {
    id: 'notification-1',
    title: 'Atualizacao',
    description: 'Descricao',
    type: 'info',
    tenantId: null,
    userId: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-14T12:00:00.000Z'),
    updatedAt: new Date('2026-03-14T12:00:00.000Z'),
    metadata: {},
  };

  const createGateway = (websocketEnabled = true) => {
    const notificationService = {
      countUnread: jest.fn().mockResolvedValue(3),
      markUserNotificationAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
    };
    const pushNotificationService = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      verify: jest.fn(),
    };
    const configService = {
      get: jest.fn(),
    };
    const prismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };
    const websocketRuntimeToggleService = {
      isEnabledCached: jest.fn().mockResolvedValue(websocketEnabled),
    };
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));

    const gateway = new NotificationGateway(
      notificationService as any,
      pushNotificationService as any,
      jwtService as any,
      configService as any,
      prismaService as any,
      websocketRuntimeToggleService as any,
    );
    gateway.server = { to } as any;
    gateways.push(gateway);

    return {
      gateway,
      notificationService,
      pushNotificationService,
      jwtService,
      prismaService,
      websocketRuntimeToggleService,
      emit,
      to,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const gateway of gateways.splice(0)) {
      gateway.onModuleDestroy();
    }
  });

  it('keeps websocket emission active when the channel is enabled', async () => {
    const { gateway, pushNotificationService, to, emit } = createGateway(true);

    await gateway.emitNewNotification(baseNotification, { push: true });

    expect(to).toHaveBeenCalledWith('global');
    expect(emit).toHaveBeenCalledWith('notification:new', baseNotification);
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith(baseNotification);
  });

  it('suppresses websocket emission but preserves push delivery when the channel is disabled', async () => {
    const { gateway, pushNotificationService, to } = createGateway(false);
    const connectedClient = {
      id: 'socket-1',
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    (gateway as any).connectedClients.set(connectedClient.id, connectedClient);
    (gateway as any).connectionStartTimes.set(connectedClient.id, Date.now());

    await gateway.emitNewNotification(baseNotification, { push: true });

    expect(to).not.toHaveBeenCalled();
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith(baseNotification);
    expect(connectedClient.emit).toHaveBeenCalledWith(
      'notification:error',
      expect.objectContaining({ code: 'WEBSOCKET_DISABLED' }),
    );
    expect(connectedClient.disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects new websocket connections when the channel is disabled', async () => {
    const { gateway, jwtService, prismaService } = createGateway(false);
    const client = {
      id: 'socket-2',
      handshake: {
        auth: { token: 'jwt-token' },
        headers: { authorization: 'Bearer jwt-token' },
      },
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as any);

    expect(jwtService.verify).not.toHaveBeenCalled();
    expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('blocks websocket-only interactions when the channel is disabled', async () => {
    const { gateway, notificationService } = createGateway(false);
    const client = {
      id: 'socket-3',
      user: { id: 'user-1' },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleMarkAsRead(client as any, { id: 'notification-1' });

    expect(notificationService.markUserNotificationAsRead).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'notification:error',
      expect.objectContaining({ code: 'WEBSOCKET_DISABLED' }),
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
