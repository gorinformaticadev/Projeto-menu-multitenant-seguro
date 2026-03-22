import { Role } from '@prisma/client';
import { SystemVersionService } from '../common/services/system-version.service';
import { MaintenanceModeService } from '../maintenance/maintenance-mode.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { ModuleSecurityService } from '../core/module-security.service';
import { SystemDashboardService } from './system-dashboard.service';
import { ResponseTimeMetricsService } from './system-response-time-metrics.service';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';

describe('SystemDashboardService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
    dashboardLayout: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
    },
    backupJob: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
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
    getSeriesForWindow: jest.fn(),
  };

  const systemTelemetryServiceMock = {
    getApiSnapshot: jest.fn(),
    getSecuritySnapshot: jest.fn(),
    maskIp: jest.fn((value) => 'masked:' + String(value)),
  };
  const moduleSecurityServiceMock = {
    getAvailableModules: jest.fn(),
  };

  const createService = () =>
    new SystemDashboardService(
      prismaMock as unknown as PrismaService,
      versionServiceMock as unknown as SystemVersionService,
      maintenanceServiceMock as unknown as MaintenanceModeService,
      responseTimeMetricsServiceMock as unknown as ResponseTimeMetricsService,
      systemTelemetryServiceMock as unknown as SystemTelemetryService,
      moduleSecurityServiceMock as unknown as ModuleSecurityService,
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
        historyWindowSeconds: 600,
        scope: 'business',
        byCategory: [],
        history: [],
      },
      getRouteLatencyMetric: {
        status: 'ok',
        windowStart: '2026-03-06T17:00:00.000Z',
        windowSeconds: 3600,
        totalRequestsRecent: 30,
        avgResponseMs: 48,
        errorRateRecent: 6.67,
        topSlowRoutes: [],
        tenantScopeApplied: false,
      },
      getRouteErrorsMetric: {
        status: 'ok',
        windowStart: '2026-03-06T17:00:00.000Z',
        windowSeconds: 3600,
        totalRequestsRecent: 30,
        totalErrorCount: 2,
        errorRateRecent: 6.67,
        topErrorRoutes: [],
        tenantScopeApplied: false,
      },
      getSecurityMetric: {
        status: 'ok',
        deniedAccess: [],
        topDeniedIps: [],
        topRateLimitedIps: [],
        maintenanceBypassAttemptsRecent: 0,
        accessDeniedRecent: [],
        routeDistribution: [],
        windowStart: '2026-03-06T17:00:00.000Z',
        windowSeconds: 3600,
        tenantScopeApplied: false,
      },
      getBackupMetric: {
        status: 'ok',
        lastBackup: null,
        recentBackups: [],
      },
      getJobsMetric: {
        status: 'ok',
        running: 1,
        pending: 2,
        failedLast24h: 0,
        lastFailure: null,
        recentFailures: [],
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
        operationalRecentCount: 0,
        recentOperationalAlerts: [],
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
    moduleSecurityServiceMock.getAvailableModules.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.tenant.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns role defaults when persisted layout does not exist', async () => {
    const service = createService();
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);
    moduleSecurityServiceMock.getAvailableModules.mockResolvedValue([
      {
        slug: 'crm',
        name: 'CRM',
        version: '1.2.0',
        description: 'Pipeline comercial',
        menus: [{ label: 'Funil', route: '/modules/crm', icon: 'Briefcase' }],
      },
    ]);

    const result = await service.getLayout({
      userId: 'user-1',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
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
    expect(result.layoutJson).toEqual({
      lg: expect.arrayContaining([expect.objectContaining({ i: 'module:crm' })]),
      md: expect.arrayContaining([expect.objectContaining({ i: 'module:crm' })]),
      sm: expect.arrayContaining([expect.objectContaining({ i: 'module:crm' })]),
    });
    expect(result.filtersJson).toEqual({
      periodMinutes: 30,
      tenantId: null,
      severity: 'all',
      operationalPinned: false,
      hiddenWidgetIds: [],
    });
    expect(result.resolution).toEqual(
      expect.objectContaining({
        source: 'role_default',
        precedence: ['user_role', 'role_default'],
      }),
    );
  });

  it('limits recent operational alerts to the active window in notifications metric', async () => {
    const service = createService();
    const windowStart = new Date('2026-03-07T10:00:00.000Z');
    prismaMock.notification.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        title: 'Aumento de erros 5xx',
        body: 'A taxa de erros 5xx ultrapassou o limite configurado.',
        severity: 'critical',
        createdAt: new Date('2026-03-07T10:30:00.000Z'),
        data: { alertAction: 'OPS_HIGH_5XX_ERROR_RATE' },
      },
    ]);

    const result = await (service as any).getNotificationsMetric(actor, windowStart);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        module: 'operational-alerts',
        createdAt: {
          gte: windowStart,
        },
      }),
      select: {
        id: true,
        title: true,
        body: true,
        severity: true,
        createdAt: true,
        data: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
    });
    expect(result).toEqual(
      expect.objectContaining({
        operationalRecentCount: 3,
        recentOperationalAlerts: [
          expect.objectContaining({
            id: 'notif-1',
            action: 'OPS_HIGH_5XX_ERROR_RATE',
          }),
        ],
      }),
    );
  });

  it('marks session cleanup operational alerts as historical when a newer materialized success exists', async () => {
    const service = createService();
    const windowStart = new Date('2026-03-07T10:00:00.000Z');
    prismaMock.notification.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'notif-session-cleanup',
        title: 'Job atrasado',
        body: 'O job Session cleanup nao executou no prazo esperado.',
        severity: 'critical',
        createdAt: new Date('2026-03-07T10:30:00.000Z'),
        data: {
          alertAction: 'JOB_NOT_RUNNING',
          jobKey: 'system.session_cleanup',
        },
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: 'execution-1',
        status: 'success',
        scheduledFor: new Date('2026-03-07T10:35:00.000Z'),
        finishedAt: new Date('2026-03-07T10:35:12.000Z'),
        updatedAt: new Date('2026-03-07T10:35:12.000Z'),
      },
    ]);

    const result = await (service as any).getNotificationsMetric(actor, windowStart);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        recentOperationalAlerts: [
          expect.objectContaining({
            id: 'notif-session-cleanup',
            action: 'JOB_NOT_RUNNING',
            jobKey: 'system.session_cleanup',
            currentState: 'success',
            isHistorical: true,
            resolutionSummary:
              'Historico: success posterior em 2026-03-07T10:35:12.000Z para o slot 2026-03-07T10:35:00.000Z.',
          }),
        ],
      }),
    );
  });

  it('sanitizes persisted layout and filters to the widget policy of the role', async () => {
    const service = createService();
    moduleSecurityServiceMock.getAvailableModules.mockResolvedValue([
      {
        slug: 'crm',
        name: 'CRM',
        version: '1.2.0',
        description: 'Pipeline comercial',
        menus: [{ label: 'Funil', route: '/modules/crm', icon: 'Briefcase' }],
      },
    ]);
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      id: 'layout-1',
      role: Role.USER,
      layoutJson: {
        lg: [{ i: 'module:crm', x: 0, y: 0, w: 1, h: 1 }, { i: 'database', x: 1, y: 0, w: 1, h: 1 }],
        md: [{ i: 'module:crm', x: 0, y: 0, w: 1, h: 1 }],
        sm: [{ i: 'workers', x: 0, y: 0, w: 1, h: 1 }],
      },
      filtersJson: {
        periodMinutes: 45,
        tenantId: 'tenant-hidden',
        severity: 'warning',
        hiddenWidgetIds: ['module:crm', 'database', 'workers'],
      },
      updatedAt: new Date('2026-03-06T18:30:00.000Z'),
    });

    const result = await service.getLayout({
      userId: 'user-1',
      role: Role.USER,
      tenantId: 'tenant-a',
    });

    expect(result.layoutJson).toEqual({
      lg: [{ i: 'module:crm', x: 0, y: 0, w: 1, h: 1 }],
      md: [{ i: 'module:crm', x: 0, y: 0, w: 1, h: 1 }],
      sm: [],
    });
    expect(result.filtersJson).toEqual({
      periodMinutes: 45,
      tenantId: null,
      severity: 'warning',
      operationalPinned: false,
      hiddenWidgetIds: ['module:crm'],
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
    moduleSecurityServiceMock.getAvailableModules.mockResolvedValue([]);
    prismaMock.dashboardLayout.upsert.mockResolvedValue({
      role: Role.SUPER_ADMIN,
      layoutJson: {
        lg: [],
        md: [],
        sm: [],
      },
      filtersJson: { periodMinutes: 60, hiddenWidgetIds: [] },
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
    expect(result.layoutJson).toEqual({
      lg: [],
      md: [],
      sm: [],
    });
    expect(result.resolution).toEqual(
      expect.objectContaining({
        source: 'user_role',
        precedence: ['user_role', 'role_default'],
      }),
    );
  });

  it('returns dashboard cards for active modules with explicit visibility rules', async () => {
    const service = createService();
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);
    moduleSecurityServiceMock.getAvailableModules.mockResolvedValue([
      {
        slug: 'crm',
        name: 'CRM',
        version: '1.2.0',
        description: 'Pipeline comercial',
        menus: [{ label: 'Funil', route: '/modules/crm', icon: 'Briefcase' }],
      },
    ]);

    const cards = await service.getModuleCards({
      userId: 'user-9',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      name: 'Ana Admin',
      email: 'ana@example.com',
      tenantName: 'Tenant Alpha',
    });
    const layout = await service.getLayout({
      userId: 'user-10',
      role: Role.SUPER_ADMIN,
      tenantId: null,
    });

    expect(cards.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'platform:welcome',
          title: 'Bem-vindo',
          module: 'platform',
          visibilityRole: Role.CLIENT,
        }),
        expect.objectContaining({
          id: 'platform:statistics',
          title: 'Estatisticas',
          module: 'platform',
          visibilityRole: Role.ADMIN,
        }),
        expect.objectContaining({
          id: 'module:crm',
          title: 'CRM',
          module: 'crm',
          href: '/modules/crm',
          visibilityRole: Role.CLIENT,
        }),
      ]),
    );
    expect(layout.layoutJson).toEqual(
      expect.objectContaining({
        lg: expect.any(Array),
        md: expect.any(Array),
        sm: expect.any(Array),
      }),
    );
    expect((layout.layoutJson as any).lg).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ i: 'operationalOverview' })]),
    );
    expect((layout.layoutJson as any).md).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ i: 'operationalOverview' })]),
    );
    expect((layout.layoutJson as any).sm).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ i: 'operationalOverview' })]),
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

  it('masks security telemetry for ADMIN and blocks telemetry widgets for basic roles', async () => {
    const service = createService();
    stubDashboardMetrics(service, {
      getSecurityMetric: {
        status: 'ok',
        deniedAccess: [{ ip: '10.0.0.15', count: 3, lastSeenAt: '2026-03-06T19:00:00.000Z', route: '/api/admin/users' }],
        topDeniedIps: [{ ip: '10.0.0.15', count: 3, lastSeenAt: '2026-03-06T19:00:00.000Z', route: '/api/admin/users' }],
        topRateLimitedIps: [{ ip: '10.0.0.25', count: 2, lastSeenAt: '2026-03-06T19:05:00.000Z', route: '/api/auth/login' }],
        maintenanceBypassAttemptsRecent: 1,
        accessDeniedRecent: [{ type: 'forbidden', statusCode: 403, method: 'GET', route: '/api/admin/users', ip: '10.0.0.15', at: '2026-03-06T19:00:00.000Z' }],
        routeDistribution: [{ route: '/api/admin/users', count: 3 }],
        windowStart: '2026-03-06T18:00:00.000Z',
        windowSeconds: 3600,
        tenantScopeApplied: false,
      },
    });

    const adminResult = await service.getDashboard({
      userId: 'admin-1',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
    });
    const userResult = await service.getDashboard({
      userId: 'user-2',
      role: Role.USER,
      tenantId: 'tenant-1',
    });

    expect(adminResult.widgets.available).toEqual(expect.arrayContaining(['routeLatency', 'routeErrors']));
    expect(adminResult.security).toEqual(
      expect.objectContaining({
        topDeniedIps: [expect.objectContaining({ ip: 'masked:10.0.0.15' })],
        topRateLimitedIps: [expect.objectContaining({ ip: 'masked:10.0.0.25' })],
      }),
    );
    expect(userResult.widgets.available).not.toContain('routeLatency');
    expect(userResult.routeLatency).toEqual({ status: 'restricted' });
    expect(userResult.routeErrors).toEqual({ status: 'restricted' });
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

  it('builds api history from the response time metrics service', async () => {
    const service = createService();
    responseTimeMetricsServiceMock.getAverageForWindow.mockReturnValue({
      averageMs: 118,
      sampleSize: 6,
      windowMs: 300_000,
    });
    responseTimeMetricsServiceMock.getCategorizedAverages.mockReturnValue({
      business: { averageMs: 118, sampleSize: 6 },
      system: { averageMs: 35, sampleSize: 3 },
      health: { averageMs: 8, sampleSize: 2 },
    });
    responseTimeMetricsServiceMock.getSeriesForWindow.mockReturnValue([
      { at: Date.parse('2026-03-06T19:20:00.000Z'), averageMs: 110, sampleSize: 2 },
      { at: Date.parse('2026-03-06T19:21:00.000Z'), averageMs: 126, sampleSize: 4 },
    ]);

    const result = await (service as any).getApiMetric(10 * 60 * 1000);

    expect(responseTimeMetricsServiceMock.getSeriesForWindow).toHaveBeenCalledWith(
      10 * 60 * 1000,
      'business',
      12,
    );
    expect(result).toEqual(
      expect.objectContaining({
        avgResponseTimeMs: 118,
        historyWindowSeconds: 600,
        history: [
          {
            at: '2026-03-06T19:20:00.000Z',
            value: 110,
            sampleSize: 2,
          },
          {
            at: '2026-03-06T19:21:00.000Z',
            value: 126,
            sampleSize: 4,
          },
        ],
      }),
    );
  });

  it('queries recent backups with descending order and backend take limit', async () => {
    const service = createService();
    prismaMock.backupJob.findMany.mockResolvedValue([]);

    await (service as any).getBackupMetric('tenant-1');

    expect(prismaMock.backupJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    );
  });

  it('queries recent failed jobs with descending order and backend take limit', async () => {
    const service = createService();
    prismaMock.backupJob.count.mockResolvedValue(0);
    prismaMock.backupJob.findMany.mockResolvedValue([]);

    await (service as any).getJobsMetric();

    expect(prismaMock.backupJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ finishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
      }),
    );
  });

  it('prunes expired cache entries and keeps the metric cache bounded', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T19:10:00.000Z'));
    const service = createService();
    const internalService = service as any;

    internalService.metricCache.set('expired-security', {
      expiresAt: Date.now() - 1,
      value: { status: 'degraded', error: 'stale' },
    });

    for (let index = 0; index < 70; index += 1) {
      internalService.writeCachedMetric(`dynamic:${index}`, 10_000, {
        status: 'ok',
        sample: index,
      });
    }

    expect(internalService.metricCache.has('expired-security')).toBe(false);
    expect(internalService.metricCache.size).toBe(64);
    expect(internalService.metricCache.has('dynamic:0')).toBe(false);
    expect(internalService.metricCache.has('dynamic:6')).toBe(true);
    expect(internalService.metricCache.has('dynamic:69')).toBe(true);
  });

  it('keeps memory history bounded to a short in-memory window', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T20:00:00.000Z'));
    const service = createService();
    const internalService = service as any;

    for (let index = 0; index < 40; index += 1) {
      internalService.recordMemoryHistorySample({
        recordedAt: Date.now(),
        usedPercent: index,
        rssBytes: 100 + index,
        heapUsedBytes: 50 + index,
      });
      jest.advanceTimersByTime(10_000);
    }

    const history = internalService.getMemoryHistorySeries();

    expect(internalService.memoryHistory.length).toBe(30);
    expect(history).toHaveLength(30);
    expect(history[0]).toEqual(
      expect.objectContaining({
        value: 10,
        rssBytes: 110,
        heapUsedBytes: 60,
      }),
    );
    expect(history[history.length - 1]).toEqual(
      expect.objectContaining({
        value: 39,
        rssBytes: 139,
        heapUsedBytes: 89,
      }),
    );
  });

  it('ignores invalid memory samples and keeps timestamps monotonic when the clock regresses', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T21:00:00.000Z'));
    const service = createService();
    const internalService = service as any;

    internalService.recordMemoryHistorySample({
      recordedAt: Date.now(),
      usedPercent: 42,
      rssBytes: 256,
      heapUsedBytes: 128,
    });

    jest.setSystemTime(new Date('2026-03-06T20:59:59.000Z'));
    internalService.recordMemoryHistorySample({
      recordedAt: Date.now(),
      usedPercent: Number.NaN,
      rssBytes: 300,
      heapUsedBytes: 150,
    });
    internalService.recordMemoryHistorySample({
      recordedAt: Date.now(),
      usedPercent: 45,
      rssBytes: 280,
      heapUsedBytes: 140,
    });
    internalService.recordMemoryHistorySample({
      recordedAt: Date.now(),
      usedPercent: 50,
      rssBytes: Number.NaN,
      heapUsedBytes: 150,
    });

    const history = internalService.getMemoryHistorySeries();

    expect(history).toHaveLength(3);
    expect(history[0].at < history[1].at).toBe(true);
    expect(history[1].at < history[2].at).toBe(true);
    expect(history[1].value).toBeNull();
    expect(history[2].value).toBe(45);
  });

  it('keeps the aggregated dashboard payload within a bounded size budget', async () => {
    const service = createService();
    const longError = 'x'.repeat(220);
    const longMessage = 'm'.repeat(220);
    const longFileName = 'backup-'.concat('a'.repeat(80)).concat('.zip');
    stubDashboardMetrics(service, {
      getApiMetric: {
        status: 'ok',
        avgResponseTimeMs: 118,
        sampleSize: 96,
        windowSeconds: 300,
        historyWindowSeconds: 900,
        scope: 'business',
        byCategory: {
          business: { averageMs: 118, sampleSize: 96 },
          system: { averageMs: 32, sampleSize: 12 },
          health: { averageMs: 8, sampleSize: 6 },
        },
        history: Array.from({ length: 12 }, (_, index) => ({
          at: `2026-03-06T21:${String(index).padStart(2, '0')}:00.000Z`,
          value: 100 + index,
          sampleSize: 8,
        })),
      },
      getMemoryMetric: {
        status: 'ok',
        totalBytes: 1024,
        freeBytes: 256,
        usedBytes: 768,
        usedPercent: 75,
        process: {
          rssBytes: 512,
          heapTotalBytes: 256,
          heapUsedBytes: 192,
          externalBytes: 32,
        },
        history: Array.from({ length: 30 }, (_, index) => ({
          at: `2026-03-06T21:${String(index).padStart(2, '0')}:30.000Z`,
          value: 40 + (index % 10),
          rssBytes: 500 + index,
          heapUsedBytes: 190 + index,
        })),
      },
      getBackupMetric: {
        status: 'ok',
        lastBackup: {
          id: 'backup-0',
          artifactId: 'artifact-0',
          fileName: longFileName,
          status: 'SUCCESS',
          sizeBytes: 512_000,
          startedAt: '2026-03-06T21:00:00.000Z',
          finishedAt: '2026-03-06T21:01:00.000Z',
          durationSeconds: 60,
        },
        recentBackups: Array.from({ length: 10 }, (_, index) => ({
          id: `backup-${index}`,
          artifactId: `artifact-${index}`,
          fileName: `${longFileName}-${index}`,
          status: 'SUCCESS',
          sizeBytes: 512_000 + index,
          startedAt: `2026-03-06T20:${String(index).padStart(2, '0')}:00.000Z`,
          finishedAt: `2026-03-06T20:${String(index).padStart(2, '0')}:45.000Z`,
          durationSeconds: 45,
        })),
      },
      getJobsMetric: {
        status: 'ok',
        running: 4,
        pending: 7,
        failedLast24h: 20,
        lastFailure: {
          id: 'job-0',
          type: 'BACKUP',
          finishedAt: '2026-03-06T21:10:00.000Z',
          error: longError,
        },
        recentFailures: Array.from({ length: 20 }, (_, index) => ({
          id: `job-${index}`,
          type: 'BACKUP',
          finishedAt: `2026-03-06T20:${String(index).padStart(2, '0')}:00.000Z`,
          error: longError,
        })),
      },
      getRecentCriticalErrorsMetric: {
        status: 'ok',
        recent: Array.from({ length: 20 }, (_, index) => ({
          id: `audit-${index}`,
          action: 'UPDATE_FAILED',
          actionLabel: 'Atualizacao falhou',
          message: longMessage,
          createdAt: `2026-03-06T19:${String(index).padStart(2, '0')}:00.000Z`,
        })),
      },
    });

    const result = await service.getDashboard(actor);
    const payloadBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');

    expect(payloadBytes).toBeLessThan(40_000);
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
          'routeLatency',
          'routeErrors',
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




