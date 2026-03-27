import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AuthorizationService } from './common/services/authorization.service';
import { RequestSecurityContextService } from './common/services/request-security-context.service';
import { WebsocketConnectionRegistryService } from './common/services/websocket-connection-registry.service';
import { SecureFileAccessGuard } from './core/secure-files/guards/secure-file-access.guard';
import { PrismaService } from './core/prisma/prisma.service';
import { NotificationGateway } from './notifications/notification.gateway';
import { NotificationService } from './notifications/notification.service';
import { UserSessionService } from './auth/user-session.service';

describe('Security red team regression attacks', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const baseActor = {
    id: 'user-1',
    email: 'user-1@example.com',
    name: 'User 1',
    role: 'ADMIN',
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    sessionVersion: 4,
  };

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('blocks websocket replay when a revoked token is reused on connection', async () => {
    const gateway = createNotificationGateway({
      authValidationService: {
        validateAccessToken: jest
          .fn()
          .mockRejectedValue(new UnauthorizedException('Token revogado')),
      },
    });
    const client = createSocketClient('socket-replay', {
      authToken: 'revoked-access-token',
    });

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emit).toHaveBeenCalledWith(
      'notification:error',
      expect.objectContaining({ code: 'SESSION_REVOKED' }),
    );
  });

  it('disconnects an already connected websocket when the session is revoked', async () => {
    const registry = new WebsocketConnectionRegistryService();
    const userSessionService = new UserSessionService(
      {
        userSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
        refreshToken: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        $transaction: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getSessionPolicy: jest.fn().mockResolvedValue({
          timeoutMinutes: 30,
        }),
      } as any,
      {
        revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      } as any,
      registry,
    );

    const client = createSocketClient('socket-live');
    registry.register({
      clientId: 'socket-live',
      userId: 'user-1',
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      disconnect: client.disconnect,
      emit: client.emit,
    });

    await userSessionService.revokeSession('session-1', 'logout');

    expect(client.emit).toHaveBeenCalledWith(
      'notification:error',
      expect.objectContaining({ code: 'SESSION_LOGOUT' }),
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('blocks cross-tenant REST access to secure files', async () => {
    const guard = new SecureFileAccessGuard(
      {
        secureFile: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'file-1',
            tenantId: 'tenant-2',
            uploadedBy: 'victim-user',
            moduleName: 'clientes',
            deletedAt: null,
          }),
        },
        module: {
          findUnique: jest.fn().mockResolvedValue({ id: 'module-1' }),
        },
        moduleTenant: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
      } as any,
      new AuthorizationService(),
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'attacker', role: 'USER', tenantId: 'tenant-1' },
          params: { fileId: 'file-1' },
          method: 'GET',
        }),
      }),
    };

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('blocks intra-tenant ownership abuse on secure file delete', async () => {
    const guard = new SecureFileAccessGuard(
      {
        secureFile: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'file-2',
            tenantId: 'tenant-1',
            uploadedBy: 'victim-user',
            moduleName: 'clientes',
            deletedAt: null,
          }),
        },
        module: {
          findUnique: jest.fn().mockResolvedValue({ id: 'module-1' }),
        },
        moduleTenant: {
          findUnique: jest.fn().mockResolvedValue({ enabled: true }),
        },
      } as any,
      new AuthorizationService(),
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'attacker', role: 'USER', tenantId: 'tenant-1' },
          params: { fileId: 'file-2' },
          method: 'DELETE',
        }),
      }),
    };

    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
  });

  it('blocks arbitrary userId filters for tenant admins on private notifications', async () => {
    const service = new NotificationService(
      {
        notification: {
          findMany: jest.fn(),
          count: jest.fn(),
        },
      } as any,
      {
        getResolved: jest.fn(),
      } as any,
      new AuthorizationService(),
    );

    await expect(
      service.findMany(
        { id: 'admin-1', role: 'ADMIN', tenantId: 'tenant-1' },
        { userId: 'victim-user' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks private notification mutation against another user in the same tenant', async () => {
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'notification-1',
          tenantId: 'tenant-1',
          userId: 'victim-user',
          targetRole: null,
          targetUserId: 'victim-user',
          audience: 'user',
        }),
        update: jest.fn(),
      },
    };
    const service = new NotificationService(
      prisma as any,
      {
        getResolved: jest.fn(),
      } as any,
      new AuthorizationService(),
    );

    const result = await service.markUserNotificationAsRead('notification-1', {
      id: 'admin-1',
      role: 'ADMIN',
      tenantId: 'tenant-1',
    });

    expect(result).toBeNull();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('blocks POST requests without CSRF token in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const response = {
      cookie: jest.fn(),
    };
    const guard = new CsrfGuard(
      new Reflector(),
      {
        getBoolean: jest.fn().mockResolvedValue(true),
      } as any,
    );
    const context = {
      getHandler: () => function csrfTestHandler() { return undefined; },
      getClass: () => class CsrfTestController {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/notifications/batch-delete',
          headers: {
            origin: 'https://app.example.com',
            referer: 'https://app.example.com/page',
            'user-agent': 'jest',
          },
          cookies: {},
        }),
        getResponse: () => response,
      }),
    };

    const frontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.com';
    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
    process.env.FRONTEND_URL = frontendUrl;
  });

  it('does not log raw websocket tokens during connection handling', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const gateway = createNotificationGateway();
    const client = createSocketClient('socket-log', {
      authToken: 'Bearer secret-realtime-token',
      cookie: 'access_token=secret-cookie-token',
    });
    client.join.mockResolvedValue(undefined);

    await gateway.handleConnection(client as any);

    const logOutput = logSpy.mock.calls
      .flat()
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join(' ');

    expect(logOutput).not.toContain('secret-realtime-token');
    expect(logOutput).not.toContain('secret-cookie-token');
  });

  it('injects tenant scope automatically on multi-tenant Prisma reads', async () => {
    const requestSecurityContext = new RequestSecurityContextService();
    const prisma = new PrismaService(requestSecurityContext);
    const next = jest.fn(async (params: any) => params);

    const result = await requestSecurityContext.runWithActor(
      { id: 'admin-1', tenantId: 'tenant-1', role: 'ADMIN' },
      () =>
        (prisma as any).applyTenantEnforcement(
          {
            model: 'SecureFile',
            action: 'findMany',
            args: {
              where: {
                id: 'file-1',
              },
            },
          },
          next,
        ),
    );

    expect(result.args.where).toEqual({
      AND: [{ id: 'file-1' }, { tenantId: 'tenant-1' }],
    });
  });

  it('blocks Prisma access when tenant context is missing for scoped models', async () => {
    const requestSecurityContext = new RequestSecurityContextService();
    const prisma = new PrismaService(requestSecurityContext);

    await expect(
      requestSecurityContext.runWithActor(
        { id: 'admin-1', role: 'ADMIN', tenantId: null },
        () =>
          (prisma as any).applyTenantEnforcement(
            {
              model: 'SecureFile',
              action: 'findMany',
              args: {},
            },
            async (params: any) => params,
          ),
      ),
    ).rejects.toThrow('Tenant scope missing');
  });

  it('blocks SUPER_ADMIN with tenantId from joining tenant admin rooms', async () => {
    const gateway = createNotificationGateway({
      authValidationService: {
        validateAccessToken: jest.fn().mockResolvedValue({
          ...baseActor,
          role: 'SUPER_ADMIN',
          tenantId: 'tenant-1',
        }),
      },
    });
    const client = createSocketClient('socket-super-admin-tenant', {
      authToken: 'Bearer test-token',
    });

    await gateway.handleConnection(client as any);

    expect(client.join).not.toHaveBeenCalledWith('tenant-1:admins');
    expect(client.join).not.toHaveBeenCalledWith('global:super-admins');
    expect(client.join).toHaveBeenCalledWith('tenant:tenant-1:user:user-1');
  });

  it('filters out SUPER_ADMIN with tenantId from tenant notification delivery', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'admin-1', role: 'ADMIN', tenantId: 'tenant-1' },
          { id: 'super-admin-legacy', role: 'SUPER_ADMIN', tenantId: 'tenant-1' },
        ]),
      },
    };
    const gateway = createNotificationGateway({ prismaService: prisma });

    // @ts-ignore - accessing private method for test
    const targetUsers = await gateway.getTargetUsers({
      id: 'notif-1',
      tenantId: 'tenant-1',
      targetRole: 'ADMIN',
    } as any);

    expect(targetUsers).toContain('admin-1');
    expect(targetUsers).not.toContain('super-admin-legacy');
  });

  it('blocks POST /auth/login without CSRF token in production', async () => {
    process.env.NODE_ENV = 'production';
    const guard = new CsrfGuard(
      new Reflector(),
      {
        getBoolean: jest.fn().mockResolvedValue(true),
      } as any,
    );
    const context = {
      getHandler: () => function loginHandler() { return undefined; },
      getClass: () => class AuthController {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/auth/login',
          headers: {
            origin: 'https://app.example.com',
            'user-agent': 'jest',
          },
          cookies: {},
        }),
        getResponse: () => ({
          cookie: jest.fn(),
        }),
      }),
    };

    const frontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.com';
    await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
    process.env.FRONTEND_URL = frontendUrl;
  });

  function createNotificationGateway(overrides?: {
    authValidationService?: { validateAccessToken: jest.Mock };
    prismaService?: any;
  }) {
    const requestSecurityContext = new RequestSecurityContextService();
    const websocketConnectionRegistry = new WebsocketConnectionRegistryService();

    return new NotificationGateway(
      {
        countUnread: jest.fn().mockResolvedValue(1),
        markUserNotificationAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
        delete: jest.fn(),
      } as any,
      {
        sendNotification: jest.fn().mockResolvedValue(undefined),
      } as any,
      overrides?.authValidationService ||
        ({
          validateAccessToken: jest.fn().mockResolvedValue(baseActor),
        } as any),
      overrides?.prismaService ||
        ({
          user: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn(),
          },
        } as any),
      {
        isEnabledCached: jest.fn().mockResolvedValue(true),
      } as any,
      requestSecurityContext,
      websocketConnectionRegistry,
      new AuthorizationService(),
      { serialize: jest.fn(), validateAndSerialize: jest.fn() } as any
    );
  }

  function createSocketClient(
    id: string,
    options?: { authToken?: string; cookie?: string },
  ) {
    return {
      id,
      handshake: {
        auth: options?.authToken ? { token: options.authToken } : undefined,
        headers: {
          authorization: options?.authToken,
          cookie: options?.cookie,
          'user-agent': 'jest',
        },
        address: '10.0.0.15',
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
  }
});
