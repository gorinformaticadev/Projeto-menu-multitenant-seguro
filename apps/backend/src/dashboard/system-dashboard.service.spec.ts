import { Role } from '@prisma/client';
import { SystemVersionService } from '../common/services/system-version.service';
import { MaintenanceModeService } from '../maintenance/maintenance-mode.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { SystemDashboardService } from './system-dashboard.service';
import { ResponseTimeMetricsService } from './system-response-time-metrics.service';

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
    getCategorizedAverages: jest.fn(),
  };

  const createService = () =>
    new SystemDashboardService(
      prismaMock as unknown as PrismaService,
      versionServiceMock as unknown as SystemVersionService,
      maintenanceServiceMock as unknown as MaintenanceModeService,
      responseTimeMetricsServiceMock as unknown as ResponseTimeMetricsService,
    );

  const actor = {
    userId: 'user-1',
    role: Role.SUPER_ADMIN,
    tenantId: null,
  };

  const stubDashboardMetrics = (
    service: SystemDashboardService,
    overrides: Partial<Record<string, unknown>> = {},
  ) => {
    const defaults: Record<string, unknown> = {
      getVersionMetric: {
        status: 'ok',
        version: 'v1.0.0',
        commitSha: 'abcdef1',
        buildDate: null,
        branch: 'main',
        source: 'test',
      },
      getUptimeMetric: {
        status: 'ok',
        seconds: 120,
        human: '00:02:00',
        startedAt: '2026-03-06T18:00:00.000Z',
      },
      getMaintenanceMetric: {
        status: 'ok',
        enabled: false,
        reason: null,
        etaSeconds: null,
        startedAt: null,
      },
      getSystemMetric: {
        status: 'ok',
        platform: 'win32',
        release: '10.0',
        arch: 'x64',
        nodeVersion: 'v24.0.0',
        pid: 1,
      },
      getCpuMetric: {
        status: 'ok',
        cores: 8,
        loadAvg: [0, 0, 0],
        usagePercent: 10,
      },
      getMemoryMetric: {
        status: 'ok',
        totalBytes: 100,
        freeBytes: 40,
        usedBytes: 60,
        usedPercent: 60,
        process: {
          rssBytes: 10,
          heapTotalBytes: 10,
          heapUsedBytes: 5,
          externalBytes: 1,
        },
      },
      getDiskMetric: {
        status: 'ok',
        path: 'C:/app',
        totalBytes: 1000,
        usedBytes: 200,
        freeBytes: 800,
        usedPercent: 20,
      },
      getDatabaseMetric: {
        status: 'healthy',
        latencyMs: 12,
      },
      getRedisMetric: {
        status: 'healthy',
        latencyMs: 4,
      },
      getWorkersMetric: {
        status: 'ok',
        activeWorkers: 2,
        runningJobs: 2,
        pendingJobs: 1,
      },
      getApiMetric: {
        status: 'ok',
        avgResponseTimeMs: 18,
        sampleSize: 4,
        windowSeconds: 300,
        scope: 'business',
        byCategory: [],
      },
      getSecurityMetric: {
        status: 'ok',
        deniedAccess: [],
        windowStart: '2026-03-06T17:00:00.000Z',
      },
      getBackupMetric: {
        status: 'ok',
        lastBackup: null,
      },
      getJobsMetric: {
        status: 'ok',
        running: 1,
        pending: 2,
        failedLast24h: 0,
        lastFailure: null,
      },
      getRecentCriticalErrorsMetric: {
        status: 'ok',
        recent: [],
      },
      getTenantsMetric: {
        status: 'ok',
        active: 4,
        total: 5,
      },
      getNotificationsMetric: {
        status: 'ok',
        criticalUnread: 0,
        criticalRecent: 0,
      },
    };

    const spies: Record<string, jest.SpyInstance> = {};

    for (const [methodName, fallbackValue] of Object.entries(defaults)) {
      const override = overrides[methodName];
      const method = jest.spyOn(
        service as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>,
        methodName,
      );
      spies[methodName] = method;

      if (override instanceof Error) {
        method.mockRejectedValue(override);
        continue;
      }

      method.mockResolvedValue(override ?? fallbackValue);
    }

    return spies;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('sanitizes persisted layout and filters to the widget policy of the role', async () => {
    const service = createService();
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      id: 'layout-1',
      role: Role.USER,
      layoutJson: {
        lg: [{ i: 'version', x: 0, y: 0, w: 1, h: 1 }, { i: 'database', x: 1, y: 0, w: 1, h: 1 }],
        md: [{ i: 'notifications', x: 0, y: 0, w: 1, h: 1 }],
        sm: [{ i: 'workers', x: 0, y: 0, w: 1, h: 1 }],
      },
      filtersJson: {
        periodMinutes: 45,
        tenantId: 'tenant-hidden',
        severity: 'warning',
        hiddenWidgetIds: ['version', 'database', 'workers'],
      },
      updatedAt: new Date('2026-03-06T18:30:00.000Z'),
    });

    const result = await service.getLayout({
      userId: 'user-1',
      role: Role.USER,
      tenantId: 'tenant-a',
    });

    expect(result.layoutJson).toEqual({
      lg: [{ i: 'version', x: 0, y: 0, w: 1, h: 1 }],
      md: [{ i: 'notifications', x: 0, y: 0, w: 1, h: 1 }],
      sm: [],
    });
    expect(result.filtersJson).toEqual({
      periodMinutes: 45,
      tenantId: null,
      severity: 'warning',
      hiddenWidgetIds: ['version'],
    });
    expect(result.resolution).toEqual(
      expect.objectContaining({
        source: 'user_role',
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

  it('does not break the aggregated response when a widget fails partially', async () => {
    const service = createService();
    stubDashboardMetrics(service, {
      getWorkersMetric: new Error('workers unavailable'),
    });

    const result = await service.getDashboard(actor);

    expect(result.version).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(result.database).toEqual(expect.objectContaining({ status: 'healthy', latencyMs: 12 }));
    expect(result.workers).toEqual({
      status: 'error',
      error: 'workers unavailable',
    });
    expect(result.widgets).toEqual(
      expect.objectContaining({
        available: expect.arrayContaining(['workers', 'jobs', 'backup']),
      }),
    );
  });

  it('caches expensive metrics for a short ttl and recomputes after expiration', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T19:00:00.000Z'));
    const service = createService();
    const spies = stubDashboardMetrics(service);
    const redisSpy = spies.getRedisMetric;

    await service.getDashboard(actor);
    await service.getDashboard(actor);

    expect(redisSpy).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-03-06T19:00:11.000Z'));
    await service.getDashboard(actor);

    expect(redisSpy).toHaveBeenCalledTimes(2);
  });

  it('returns the explicit widget policy for the actor role', async () => {
    const service = createService();
    stubDashboardMetrics(service);

    const adminResult = await service.getDashboard({
      userId: 'admin-1',
      role: Role.ADMIN,
      tenantId: null,
    });
    const userResult = await service.getDashboard({
      userId: 'user-1',
      role: Role.USER,
      tenantId: null,
    });

    expect(adminResult.widgets).toEqual(
      expect.objectContaining({
        available: [
          'version',
          'uptime',
          'maintenance',
          'api',
          'cpu',
          'memory',
          'database',
          'jobs',
          'backup',
          'errors',
          'security',
          'notifications',
        ],
      }),
    );
    expect(userResult.widgets).toEqual(
      expect.objectContaining({
        available: ['version', 'uptime', 'maintenance', 'api', 'notifications'],
      }),
    );
  });
});
