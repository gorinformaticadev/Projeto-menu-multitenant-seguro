import { Role } from '@prisma/client';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';
import { SystemDiagnosticsService } from './system-diagnostics.service';

describe('SystemDiagnosticsService', () => {
  const prismaMock = {
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const dashboardServiceMock = {
    getDashboard: jest.fn(),
  };

  const cronServiceMock = {
    getRuntimeJobs: jest.fn(),
  };

  const updateServiceMock = {
    getUpdateStatus: jest.fn(),
    getUpdateLogs: jest.fn(),
  };

  const backupServiceMock = {
    listBackupsAndJobs: jest.fn(),
  };

  const auditServiceMock = {
    findAll: jest.fn(),
  };

  const systemTelemetryServiceMock = {
    getOperationalSnapshot: jest.fn(),
  };

  const actor = {
    userId: 'user-1',
    role: Role.ADMIN,
    tenantId: null,
    name: 'Admin',
    email: 'admin@example.com',
    tenantName: null,
  };

  let service: SystemDiagnosticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SystemDiagnosticsService(
      prismaMock as any,
      dashboardServiceMock as any,
      cronServiceMock as any,
      updateServiceMock as any,
      backupServiceMock as any,
      auditServiceMock as any,
      systemTelemetryServiceMock as unknown as SystemTelemetryService,
    );
    systemTelemetryServiceMock.getOperationalSnapshot.mockReturnValue({
      total: 0,
      windowMs: 60 * 60 * 1000,
      byType: [],
      recent: [],
    });
  });

  it('derives a critical overall state when scheduler/runtime and alerts indicate real issues', async () => {
    dashboardServiceMock.getDashboard.mockResolvedValue({
      version: { version: 'v3.1.0' },
      uptime: { human: '2h 10m', startedAt: '2026-03-07T12:00:00.000Z' },
      maintenance: { enabled: false, reason: null, startedAt: null },
      database: { status: 'healthy' },
      redis: { status: 'healthy' },
      routeErrors: { errorRateRecent: 2.5 },
      errors: { recent: [] },
    });
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.update_check',
        name: 'Update check',
        schedule: '0 * * * *',
        enabled: true,
        runtimeRegistered: false,
        issue: 'runtime_not_registered',
      },
    ]);
    updateServiceMock.getUpdateStatus.mockResolvedValue({
      currentVersion: 'v3.1.0',
      availableVersion: null,
      updateAvailable: false,
      lastCheck: '2026-03-07T13:00:00.000Z',
    });
    updateServiceMock.getUpdateLogs.mockResolvedValue([]);
    backupServiceMock.listBackupsAndJobs.mockResolvedValue({ artifacts: [], jobs: [] });
    prismaMock.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        title: 'Redis degradado',
        body: 'Banco de dados ou Redis apresentou degradacao persistente.',
        severity: 'critical',
        source: 'operational-alerts',
        createdAt: new Date('2026-03-07T14:00:00.000Z'),
        data: { alertAction: 'OPS_REDIS_DEGRADED' },
      },
    ]);
    auditServiceMock.findAll.mockResolvedValue({ data: [] });

    const result = await service.getDiagnostics(actor);

    expect(result.overall.level).toBe('critical');
    expect(result.scheduler.status).toBe('ok');
    expect(result.scheduler.status === 'ok' && result.scheduler.missingRuntime).toBe(1);
    expect(result.alerts.status).toBe('ok');
    expect(result.alerts.status === 'ok' && result.alerts.criticalCount).toBe(1);
    expect(result.logs.status).toBe('ok');
    expect(result.logs.status === 'ok' && result.logs.exists).toBe(true);
    expect(result.logs.status === 'ok' && result.logs.pageKind).toBe('auditoria-sistema');
  });

  it('reuses existing audit/update/backup sources for the logs section without inventing generic runtime logs', async () => {
    dashboardServiceMock.getDashboard.mockResolvedValue({
      version: { version: 'v3.1.0' },
      uptime: { human: '3h', startedAt: '2026-03-07T11:00:00.000Z' },
      maintenance: { enabled: false, reason: null, startedAt: null },
      database: { status: 'healthy' },
      redis: { status: 'healthy' },
      routeErrors: { errorRateRecent: 0.4 },
      errors: { recent: [] },
    });
    cronServiceMock.getRuntimeJobs.mockResolvedValue([]);
    updateServiceMock.getUpdateStatus.mockResolvedValue({
      currentVersion: 'v3.1.0',
      availableVersion: null,
      updateAvailable: false,
      lastCheck: null,
    });
    updateServiceMock.getUpdateLogs.mockResolvedValue([
      {
        id: 'upd-1',
        version: 'v3.1.0',
        status: 'FAILED',
        startedAt: new Date('2026-03-07T10:00:00.000Z'),
        completedAt: new Date('2026-03-07T10:02:00.000Z'),
        duration: 120,
        rollbackReason: null,
        errorMessage: 'git pull failed',
      },
    ]);
    backupServiceMock.listBackupsAndJobs.mockResolvedValue({
      artifacts: [],
      jobs: [
        {
          id: 'job-1',
          type: 'RESTORE',
          status: 'FAILED',
          fileName: 'backup.zip',
          createdAt: new Date('2026-03-07T09:00:00.000Z'),
          startedAt: new Date('2026-03-07T09:01:00.000Z'),
          finishedAt: new Date('2026-03-07T09:03:00.000Z'),
          error: 'checksum mismatch',
        },
      ],
    });
    prismaMock.notification.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.notification.findMany.mockResolvedValue([]);
    auditServiceMock.findAll.mockResolvedValue({ data: [] });

    const result = await service.getDiagnostics({
      ...actor,
      role: Role.SUPER_ADMIN,
    });

    expect(result.logs.status).toBe('ok');
    if (result.logs.status !== 'ok') {
      throw new Error('logs section should be ok');
    }

    expect(result.logs.coverage).toEqual([
      'Auditoria do sistema',
      'Historico de atualizacoes',
      'Historico de backup e restore',
    ]);
    expect(result.logs.limitations[0]).toContain('Nao existe persistencia generica unica');
    expect(result.logs.recentTechnicalIssues).toHaveLength(2);
    expect(result.logs.pageKind).toBe('auditoria-completa');
  });
});
