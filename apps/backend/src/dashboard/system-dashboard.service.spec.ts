import { Role } from '@prisma/client';
import { SystemDashboardService } from './system-dashboard.service';

describe('SystemDashboardService', () => {
  const prismaMock = {
    dashboardLayout: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const versionServiceMock = {
    getVersionInfo: jest.fn(),
  };

  const maintenanceServiceMock = {
    getState: jest.fn(),
  };

  const responseTimeMetricsServiceMock = {
    getAverageForWindow: jest.fn(),
  };

  const createService = () =>
    new SystemDashboardService(
      prismaMock as any,
      versionServiceMock as any,
      maintenanceServiceMock as any,
      responseTimeMetricsServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns role defaults when persisted layout does not exist', async () => {
    const service = createService();
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);

    const result = await service.getLayout({
      userId: 'user-1',
      role: Role.ADMIN,
      tenantId: null,
    });

    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: {
        userId_role: {
          userId: 'user-1',
          role: Role.ADMIN,
        },
      },
      select: {
        id: true,
        role: true,
        layoutJson: true,
        filtersJson: true,
        updatedAt: true,
      },
    });
    expect(result.role).toBe(Role.ADMIN);
    expect(result.updatedAt).toBeNull();
    expect(result.layoutJson).toBeDefined();
    expect(result.filtersJson).toBeDefined();
    expect(result.resolution).toEqual(
      expect.objectContaining({
        source: 'role_default',
        precedence: ['user_role', 'role_default'],
      }),
    );
  });

  it('saves layout with safe fallback when payload is invalid', async () => {
    const service = createService();
    prismaMock.dashboardLayout.upsert.mockResolvedValue({
      role: Role.SUPER_ADMIN,
      layoutJson: { lg: [] },
      filtersJson: { periodMinutes: 60 },
      updatedAt: new Date('2026-03-06T18:30:00.000Z'),
    });

    const result = await service.saveLayout(
      {
        userId: 'user-2',
        role: Role.SUPER_ADMIN,
        tenantId: null,
      },
      {
        layoutJson: 'invalid',
        filtersJson: null,
      },
    );

    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_role: {
            userId: 'user-2',
            role: Role.SUPER_ADMIN,
          },
        },
      }),
    );
    expect(result.role).toBe(Role.SUPER_ADMIN);
    expect(result.updatedAt).toBe('2026-03-06T18:30:00.000Z');
    expect(result.resolution).toEqual(
      expect.objectContaining({
        source: 'user_role',
        precedence: ['user_role', 'role_default'],
      }),
    );
  });
});
