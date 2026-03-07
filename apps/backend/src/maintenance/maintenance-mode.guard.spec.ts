import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MaintenanceModeGuard } from './maintenance-mode.guard';

describe('MaintenanceModeGuard', () => {
  const maintenanceModeServiceMock = {
    getState: jest.fn(),
  };
  const jwtServiceMock = {
    verify: jest.fn(),
  };
  const auditServiceMock = {
    log: jest.fn(),
  };
  const notificationServiceMock = {
    emitSystemAlert: jest.fn(),
  };
  const systemTelemetryServiceMock = {
    recordSecurityEvent: jest.fn(),
  };

  let previousBypassToken: string | undefined;
  let previousJwtSecret: string | undefined;

  const createGuard = () =>
    new MaintenanceModeGuard(
      maintenanceModeServiceMock as any,
      jwtServiceMock as unknown as JwtService,
      auditServiceMock as any,
      notificationServiceMock as any,
      systemTelemetryServiceMock as any,
    );

  const createContext = (request: any): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    previousBypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.MAINTENANCE_BYPASS_TOKEN = 'bypass-token';
    process.env.JWT_SECRET = 'jwt-secret';
  });

  afterEach(() => {
    if (previousBypassToken === undefined) {
      delete process.env.MAINTENANCE_BYPASS_TOKEN;
    } else {
      process.env.MAINTENANCE_BYPASS_TOKEN = previousBypassToken;
    }

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  it('creates MAINTENANCE_BYPASS_USED audit log for SUPER_ADMIN bypass token usage', async () => {
    const guard = createGuard();
    const request: any = {
      method: 'GET',
      originalUrl: '/api/private/resource',
      headers: {
        authorization: 'Bearer valid-token',
        'x-maintenance-bypass': 'bypass-token',
        'user-agent': 'jest',
      },
      ip: '10.0.0.10',
      query: {},
    };

    maintenanceModeServiceMock.getState.mockResolvedValue({
      enabled: true,
      reason: 'manutencao',
      startedAt: '2026-03-06T12:00:00.000Z',
      etaSeconds: 300,
      allowedRoles: ['SUPER_ADMIN'],
      bypassHeader: 'X-Maintenance-Bypass',
    });

    jwtServiceMock.verify.mockReturnValue({
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
    });

    const allowed = await guard.canActivate(createContext(request));

    expect(allowed).toBe(true);
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MAINTENANCE_BYPASS_USED',
        severity: 'critical',
        metadata: expect.objectContaining({
          route: '/api/private/resource',
          method: 'GET',
        }),
      }),
    );
    expect(notificationServiceMock.emitSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MAINTENANCE_BYPASS_USED',
        severity: 'critical',
      }),
    );
  });

  it('allows dashboard read during maintenance for ADMIN token', async () => {
    const guard = createGuard();
    const request: any = {
      method: 'GET',
      originalUrl: '/api/system/dashboard?periodMinutes=15',
      headers: {
        authorization: 'Bearer admin-token',
      },
    };

    maintenanceModeServiceMock.getState.mockResolvedValue({
      enabled: true,
      reason: 'manutencao',
      startedAt: null,
      etaSeconds: 600,
      allowedRoles: ['SUPER_ADMIN'],
      bypassHeader: 'X-Maintenance-Bypass',
    });

    jwtServiceMock.verify.mockReturnValue({
      role: 'ADMIN',
      sub: 'admin-1',
    });

    const allowed = await guard.canActivate(createContext(request));

    expect(allowed).toBe(true);
    expect(jwtServiceMock.verify).toHaveBeenCalledWith('admin-token', {
      secret: 'jwt-secret',
    });
  });

  it('blocks dashboard read during maintenance for USER token', async () => {
    const guard = createGuard();
    const request: any = {
      method: 'GET',
      originalUrl: '/api/system/dashboard',
      headers: {
        authorization: 'Bearer user-token',
      },
    };

    maintenanceModeServiceMock.getState.mockResolvedValue({
      enabled: true,
      reason: 'manutencao',
      startedAt: null,
      etaSeconds: 600,
      allowedRoles: ['SUPER_ADMIN'],
      bypassHeader: 'X-Maintenance-Bypass',
    });

    jwtServiceMock.verify.mockReturnValue({
      role: 'USER',
      sub: 'user-1',
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(systemTelemetryServiceMock.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'maintenance_blocked',
        statusCode: 503,
      }),
    );
  });
});


