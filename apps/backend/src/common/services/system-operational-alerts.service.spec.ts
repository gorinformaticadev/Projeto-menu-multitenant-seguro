import { BackupJobStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationGateway } from '../../notifications/notification.gateway';
import { Notification } from '../../notifications/notification.entity';
import { NotificationService } from '../../notifications/notification.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { SystemTelemetryService } from './system-telemetry.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';

describe('SystemOperationalAlertsService', () => {
  const prismaMock = {
    backupJob: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const notificationServiceMock = {
    createSystemNotificationEntity: jest.fn(),
  };
  const notificationGatewayMock = {
    emitNewNotification: jest.fn(),
  };
  const pushNotificationServiceMock = {
    getPublicKey: jest.fn(),
  };
  const auditServiceMock = {
    log: jest.fn(),
  };

  const baseNotification: Notification = {
    id: 'notification-1',
    title: 'Alerta',
    description: 'Descricao',
    type: 'warning',
    tenantId: null,
    userId: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-07T14:00:00.000Z'),
    updatedAt: new Date('2026-03-07T14:00:00.000Z'),
    metadata: {},
  };

  let telemetryService: SystemTelemetryService;
  let service: SystemOperationalAlertsService;
  let previousEnv: Record<string, string | undefined>;

  const createService = () =>
    new SystemOperationalAlertsService(
      prismaMock as unknown as PrismaService,
      telemetryService,
      notificationServiceMock as unknown as NotificationService,
      notificationGatewayMock as unknown as NotificationGateway,
      pushNotificationServiceMock as unknown as PushNotificationService,
      auditServiceMock as unknown as AuditService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T14:00:00.000Z'));
    telemetryService = new SystemTelemetryService();
    service = createService();
    previousEnv = {
      OPS_ALERT_5XX_RATE_THRESHOLD: process.env.OPS_ALERT_5XX_RATE_THRESHOLD,
      OPS_ALERT_WINDOW_MINUTES: process.env.OPS_ALERT_WINDOW_MINUTES,
      OPS_ALERT_MIN_REQUEST_SAMPLE: process.env.OPS_ALERT_MIN_REQUEST_SAMPLE,
      OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD: process.env.OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD,
      OPS_ALERT_MIN_ROUTE_SAMPLE: process.env.OPS_ALERT_MIN_ROUTE_SAMPLE,
      OPS_ALERT_DENIED_SPIKE_THRESHOLD: process.env.OPS_ALERT_DENIED_SPIKE_THRESHOLD,
      OPS_ALERT_MIN_DENIED_SAMPLE: process.env.OPS_ALERT_MIN_DENIED_SAMPLE,
      OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD: process.env.OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD,
      OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE:
        process.env.OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE,
      OPS_ALERT_COOLDOWN_MINUTES: process.env.OPS_ALERT_COOLDOWN_MINUTES,
    };

    process.env.OPS_ALERT_5XX_RATE_THRESHOLD = '5';
    process.env.OPS_ALERT_WINDOW_MINUTES = '5';
    process.env.OPS_ALERT_MIN_REQUEST_SAMPLE = '5';
    process.env.OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD = '900';
    process.env.OPS_ALERT_MIN_ROUTE_SAMPLE = '3';
    process.env.OPS_ALERT_DENIED_SPIKE_THRESHOLD = '4';
    process.env.OPS_ALERT_MIN_DENIED_SAMPLE = '4';
    process.env.OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD = '3';
    process.env.OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE = '2';
    process.env.OPS_ALERT_COOLDOWN_MINUTES = '15';

    notificationServiceMock.createSystemNotificationEntity.mockResolvedValue(baseNotification);
    pushNotificationServiceMock.getPublicKey.mockResolvedValue('public-key');
    prismaMock.backupJob.findMany.mockResolvedValue([]);
    jest
      .spyOn(service as any, 'checkDatabaseHealth')
      .mockResolvedValue({ status: 'healthy', latencyMs: 12 });
    jest
      .spyOn(service as any, 'checkRedisHealth')
      .mockResolvedValue({ status: 'healthy', latencyMs: 6 });
  });

  afterEach(() => {
    jest.useRealTimers();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('does not emit 5xx alert without minimum request sample', async () => {
    telemetryService.recordRequest({ method: 'GET', route: '/api/orders/1', durationMs: 120, statusCode: 500 });
    telemetryService.recordRequest({ method: 'GET', route: '/api/orders/2', durationMs: 150, statusCode: 500 });
    telemetryService.recordRequest({ method: 'GET', route: '/api/orders/3', durationMs: 180, statusCode: 200 });
    telemetryService.recordRequest({ method: 'GET', route: '/api/orders/4', durationMs: 160, statusCode: 200 });

    const result = await service.evaluateOperationalAlerts(new Date());

    expect(result.emitted).not.toContain('OPS_HIGH_5XX_ERROR_RATE');
    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
  });

  it('applies cooldown to repeated critical alerts', async () => {
    for (let index = 1; index <= 5; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: `/api/users/${index}`,
        durationMs: 220,
        statusCode: index <= 3 ? 500 : 200,
      });
    }

    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledTimes(1);
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledTimes(1);
  });

  it('emits warning alerts as inbox only without push', async () => {
    telemetryService.recordSecurityEvent({
      type: 'forbidden',
      method: 'GET',
      route: '/api/admin/users/1',
      ip: '10.0.0.10',
      statusCode: 403,
    });
    telemetryService.recordSecurityEvent({
      type: 'forbidden',
      method: 'GET',
      route: '/api/admin/users/2',
      ip: '10.0.0.11',
      statusCode: 403,
    });
    telemetryService.recordSecurityEvent({
      type: 'rate_limited',
      method: 'POST',
      route: '/api/auth/login',
      ip: '10.0.0.20',
      statusCode: 429,
    });
    telemetryService.recordSecurityEvent({
      type: 'unauthorized',
      method: 'GET',
      route: '/api/admin/users/3',
      ip: '10.0.0.12',
      statusCode: 401,
    });

    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Pico de acessos negados',
        severity: 'warning',
      }),
    );
    expect(pushNotificationServiceMock.getPublicKey).not.toHaveBeenCalled();
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: false }),
    );
  });

  it('emits critical alerts with push when infra is available', async () => {
    for (let index = 1; index <= 6; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: `/api/payments/${index}`,
        durationMs: 140,
        statusCode: index <= 4 ? 500 : 200,
      });
    }

    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Aumento de erros 5xx',
        severity: 'critical',
      }),
    );
    expect(pushNotificationServiceMock.getPublicKey).toHaveBeenCalledTimes(1);
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: true }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPS_HIGH_5XX_ERROR_RATE',
        severity: 'critical',
      }),
    );
  });

  it('falls back to inbox only when push is unavailable', async () => {
    pushNotificationServiceMock.getPublicKey.mockResolvedValue(null);
    prismaMock.backupJob.findMany.mockResolvedValue([
      { id: 'job-1', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:58:00.000Z') },
      { id: 'job-2', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:57:00.000Z') },
      { id: 'job-3', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:56:00.000Z') },
    ]);

    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Falhas repetidas em jobs',
      }),
    );
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: false }),
    );
  });

  it('ignores excluded internal dashboard routes when evaluating request alerts', async () => {
    for (let index = 0; index < 10; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: '/api/system/dashboard/module-cards',
        durationMs: 2_000,
        statusCode: 500,
      });
    }

    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
  });

  it('requires consecutive degraded checks before emitting infra alert', async () => {
    const databaseSpy = jest
      .spyOn(service as any, 'checkDatabaseHealth')
      .mockResolvedValue({ status: 'error', latencyMs: null });

    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());

    expect(databaseSpy).toHaveBeenCalledTimes(2);
    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Servico degradado',
        data: expect.objectContaining({
          service: 'database',
          consecutiveChecks: 2,
        }),
      }),
    );
  });

  it('uses cooldown and push policy for maintenance bypass notifications', async () => {
    await service.notifyMaintenanceBypassUsed({
      method: 'GET',
      route: '/api/system/update/run',
    });
    await service.notifyMaintenanceBypassUsed({
      method: 'GET',
      route: '/api/system/update/run',
    });

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledTimes(1);
    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bypass de manutencao utilizado',
        source: 'maintenance',
      }),
    );
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: true }),
    );
  });
});
