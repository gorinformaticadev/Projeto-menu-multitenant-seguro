import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemDashboardController } from './system-dashboard.controller';

describe('SystemDashboardController', () => {
  const createDashboardAggregateResponse = () => ({
    generatedAt: new Date().toISOString(),
    responseTimeMs: 12,
    filtersApplied: {
      periodMinutes: 15,
      tenantId: 'tenant-a',
      severity: 'critical',
    },
    version: {
      status: 'ok',
      version: '1.0.0',
      commitSha: null,
      buildDate: null,
      branch: null,
      source: 'test',
    },
    uptime: {
      status: 'ok',
      seconds: 120,
      human: '00:02:00',
      startedAt: new Date().toISOString(),
    },
    maintenance: {
      status: 'ok',
      enabled: false,
      reason: null,
      etaSeconds: null,
      startedAt: null,
    },
    system: { status: 'restricted' },
    cpu: { status: 'restricted' },
    memory: { status: 'restricted' },
    disk: { status: 'restricted' },
    database: { status: 'restricted' },
    redis: { status: 'restricted' },
    workers: { status: 'restricted' },
    api: { status: 'unavailable', error: 'telemetry offline' },
    routeLatency: { status: 'restricted' },
    routeErrors: { status: 'restricted' },
    security: { status: 'restricted' },
    backup: { status: 'restricted' },
    jobs: { status: 'restricted' },
    errors: { status: 'restricted' },
    tenants: { status: 'restricted' },
    notifications: {
      status: 'ok',
      criticalUnread: 0,
      criticalRecent: 0,
      operationalRecentCount: 0,
      recentOperationalAlerts: [
        {
          id: 'alert-1',
          title: 'CPU alta',
          body: 'Uso elevado detectado',
          severity: 'critical',
          createdAt: new Date().toISOString(),
          action: 'abrir',
        },
      ],
    },
    widgets: { available: ['version'] },
  });

  const dashboardServiceMock = {
    getDashboard: jest.fn(),
    getModuleCards: jest.fn(),
    getLayout: jest.fn(),
    saveLayout: jest.fn(),
  };

  const createController = () => new SystemDashboardController(dashboardServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects controller with JWT + roles and restricts operational aggregate to SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemDashboardController) || [];
    const controllerRoles = Reflect.getMetadata(ROLES_KEY, SystemDashboardController) || [];
    const methodRoles =
      Reflect.getMetadata(ROLES_KEY, SystemDashboardController.prototype.getDashboard) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(controllerRoles).toEqual(['SUPER_ADMIN', 'ADMIN', 'USER', 'CLIENT']);
    expect(methodRoles).toEqual(['SUPER_ADMIN']);
  });

  it('delegates dashboard query with parsed period', async () => {
    const controller = createController();
    dashboardServiceMock.getDashboard.mockResolvedValue(createDashboardAggregateResponse());

    const req = { user: { id: 'u1', role: 'SUPER_ADMIN', tenantId: null }, apiVersion: '2' };
    await controller.getDashboard(req, {
      periodMinutes: 15,
      tenantId: 'tenant-a',
      severity: 'critical',
    });

    expect(dashboardServiceMock.getDashboard).toHaveBeenCalledWith(
      {
        userId: 'u1',
        role: 'SUPER_ADMIN',
        tenantId: null,
        name: null,
        email: null,
        tenantName: null,
      },
      {
        periodMinutes: 15,
        tenantId: 'tenant-a',
        severity: 'critical',
      },
      '2',
    );
  });

  it('projects the aggregate response according to req.apiVersion', async () => {
    const controller = createController();
    dashboardServiceMock.getDashboard.mockImplementation(
      async (_actor, _filters, apiVersion?: '1' | '2') => {
        const response = createDashboardAggregateResponse();
        if (apiVersion === '1' && response.notifications.status === 'ok') {
          return {
            ...response,
            notifications: {
              ...response.notifications,
              recentOperationalAlerts: response.notifications.recentOperationalAlerts.map(
                ({ action: _action, ...legacyAlert }) => legacyAlert,
              ),
            },
          };
        }

        return response;
      },
    );

    const legacyResponse = await controller.getDashboard(
      { user: { id: 'u1', role: 'SUPER_ADMIN', tenantId: null }, apiVersion: '1' },
      {
        periodMinutes: 15,
        tenantId: 'tenant-a',
        severity: 'critical',
      },
    );

    expect(
      legacyResponse.notifications.status === 'ok'
        ? legacyResponse.notifications.recentOperationalAlerts[0]
        : null,
    ).toEqual(
      expect.not.objectContaining({
        action: expect.anything(),
      }),
    );
  });

  it('loads and saves layout using actor context', async () => {
    const controller = createController();
    dashboardServiceMock.getLayout.mockResolvedValue({
      role: 'SUPER_ADMIN',
      layoutJson: { lg: [] },
      filtersJson: {
        periodMinutes: 30,
        severity: 'all',
        hiddenWidgetIds: [],
      },
      updatedAt: new Date().toISOString(),
      resolution: { source: 'user_role' },
    });
    dashboardServiceMock.saveLayout.mockResolvedValue({
      role: 'SUPER_ADMIN',
      layoutJson: { lg: [] },
      filtersJson: {
        periodMinutes: 30,
        severity: 'all',
        hiddenWidgetIds: [],
      },
      updatedAt: new Date().toISOString(),
      resolution: { source: 'user_role' },
    });

    const req = { user: { sub: 'u2', role: 'SUPER_ADMIN', tenantId: null } };

    await controller.getLayout(req);
    await controller.saveLayout(req, {
      layoutJson: { lg: [] },
      filtersJson: { periodMinutes: 30 },
    });

    expect(dashboardServiceMock.getLayout).toHaveBeenCalledWith({
      userId: 'u2',
      role: 'SUPER_ADMIN',
      tenantId: null,
      name: null,
      email: null,
      tenantName: null,
    });
    expect(dashboardServiceMock.saveLayout).toHaveBeenCalledWith(
      {
        userId: 'u2',
        role: 'SUPER_ADMIN',
        tenantId: null,
        name: null,
        email: null,
        tenantName: null,
      },
      {
        layoutJson: { lg: [] },
        filtersJson: { periodMinutes: 30 },
      },
    );
  });

  it('loads module cards using actor context', async () => {
    const controller = createController();
    dashboardServiceMock.getModuleCards.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      cards: [],
      widgets: { available: [] },
    });

    const req = { user: { sub: 'u3', role: 'ADMIN', tenantId: 'tenant-1' } };
    await controller.getModuleCards(req);

    expect(dashboardServiceMock.getModuleCards).toHaveBeenCalledWith({
      userId: 'u3',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      name: null,
      email: null,
      tenantName: null,
    });
  });
});
