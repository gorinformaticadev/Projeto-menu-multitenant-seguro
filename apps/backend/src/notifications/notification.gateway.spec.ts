import { NotificationGateway } from './notification.gateway';
import { Notification } from './notification.entity';
import { RequestSecurityContextService } from '@common/services/request-security-context.service';

describe('NotificationGateway websocket hardening', () => {
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

  const authenticatedUser = {
    id: 'user-1',
    email: 'user-1@example.com',
    name: 'User 1',
    role: 'ADMIN',
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    sessionVersion: 2,
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
    const authValidationService = {
      validateAccessToken: jest.fn().mockResolvedValue(authenticatedUser),
    };
    const prismaService = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const websocketRuntimeToggleService = {
      isEnabledCached: jest.fn().mockResolvedValue(websocketEnabled),
    };
    const requestSecurityContext = new RequestSecurityContextService();
    const websocketConnectionRegistry = {
      register: jest.fn(),
      unregister: jest.fn(),
    };
    const authorizationService = {
      canAccessModule: jest.fn().mockResolvedValue(true),
    };
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));

    const gateway = new NotificationGateway(
      notificationService as any,
      pushNotificationService as any,
      authValidationService as any,
      prismaService as any,
      websocketRuntimeToggleService as any,
      requestSecurityContext,
      websocketConnectionRegistry as any,
      authorizationService as any,
    );
    gateway.server = { to } as any;
    gateways.push(gateway);

    return {
      gateway,
      notificationService,
      pushNotificationService,
      authValidationService,
      prismaService,
      websocketRuntimeToggleService,
      websocketConnectionRegistry,
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

    expect(to).toHaveBeenCalledWith('global:super-admins');
    expect(emit).toHaveBeenCalledWith('notification:new', baseNotification);
    expect(pushNotificationService.sendNotification).toHaveBeenCalledWith(baseNotification);
  });

  it('suppresses websocket emission but preserves push delivery when the channel is disabled', async () => {
    const { gateway, pushNotificationService, to, websocketConnectionRegistry } = createGateway(false);
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
    expect(websocketConnectionRegistry.unregister).toHaveBeenCalledWith('socket-1');
  });

  it('rejects new websocket connections when the channel is disabled', async () => {
    const { gateway, authValidationService } = createGateway(false);
    const client = {
      id: 'socket-2',
      handshake: {
        auth: { token: 'jwt-token' },
        headers: { authorization: 'Bearer jwt-token' },
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as any);

    expect(authValidationService.validateAccessToken).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('registers authenticated sockets by session and joins tenant-scoped rooms', async () => {
    const { gateway, authValidationService, notificationService, websocketConnectionRegistry } =
      createGateway(true);
    const client = {
      id: 'socket-3',
      handshake: {
        auth: { token: 'jwt-token' },
        headers: {
          authorization: 'Bearer jwt-token',
          'user-agent': 'jest',
        },
        address: '10.0.0.15',
      },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as any);

    expect(authValidationService.validateAccessToken).toHaveBeenCalledWith(
      'jwt-token',
      expect.objectContaining({
        source: 'websocket',
        ipAddress: '10.0.0.15',
        userAgent: 'jest',
      }),
    );
    expect(websocketConnectionRegistry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'socket-3',
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
      }),
    );
    expect(client.join).toHaveBeenCalledWith('tenant:tenant-1:user:user-1');
    expect(client.join).toHaveBeenCalledWith('tenant:tenant-1:admins');
    expect(notificationService.countUnread).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('blocks websocket-only interactions when token revalidation fails', async () => {
    const { gateway, authValidationService, notificationService, websocketConnectionRegistry } =
      createGateway(true);
    authValidationService.validateAccessToken.mockRejectedValueOnce(new Error('revoked'));

    const client = {
      id: 'socket-4',
      accessToken: 'jwt-token',
      user: authenticatedUser,
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleMarkAsRead(client as any, { id: 'notification-1' });

    expect(notificationService.markUserNotificationAsRead).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'notification:error',
      expect.objectContaining({ code: 'SESSION_REVOKED' }),
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(websocketConnectionRegistry.unregister).toHaveBeenCalledWith('socket-4');
  });
});
