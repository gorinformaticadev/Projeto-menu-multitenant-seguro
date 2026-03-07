import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemDashboardController } from './system-dashboard.controller';

describe('SystemDashboardController', () => {
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
    expect(controllerRoles).toEqual([Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT]);
    expect(methodRoles).toEqual([Role.SUPER_ADMIN]);
  });

  it('delegates dashboard query with parsed period', async () => {
    const controller = createController();
    dashboardServiceMock.getDashboard.mockResolvedValue({ ok: true });

    const req = { user: { id: 'u1', role: 'SUPER_ADMIN', tenantId: null } };
    await controller.getDashboard(req, {
      periodMinutes: '15',
      tenantId: 'tenant-a',
      severity: 'critical',
    });

    expect(dashboardServiceMock.getDashboard).toHaveBeenCalledWith(
      {
        userId: 'u1',
        role: Role.SUPER_ADMIN,
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
    );
  });

  it('loads and saves layout using actor context', async () => {
    const controller = createController();
    dashboardServiceMock.getLayout.mockResolvedValue({ role: 'SUPER_ADMIN' });
    dashboardServiceMock.saveLayout.mockResolvedValue({ role: 'SUPER_ADMIN' });

    const req = { user: { sub: 'u2', role: 'SUPER_ADMIN', tenantId: null } };

    await controller.getLayout(req);
    await controller.saveLayout(req, {
      layoutJson: { lg: [] },
      filtersJson: { periodMinutes: 30 },
    });

    expect(dashboardServiceMock.getLayout).toHaveBeenCalledWith({
      userId: 'u2',
      role: Role.SUPER_ADMIN,
      tenantId: null,
      name: null,
      email: null,
      tenantName: null,
    });
    expect(dashboardServiceMock.saveLayout).toHaveBeenCalledWith(
      {
        userId: 'u2',
        role: Role.SUPER_ADMIN,
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
    dashboardServiceMock.getModuleCards.mockResolvedValue({ cards: [] });

    const req = { user: { sub: 'u3', role: 'ADMIN', tenantId: 'tenant-1' } };
    await controller.getModuleCards(req);

    expect(dashboardServiceMock.getModuleCards).toHaveBeenCalledWith({
      userId: 'u3',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      name: null,
      email: null,
      tenantName: null,
    });
  });
});
