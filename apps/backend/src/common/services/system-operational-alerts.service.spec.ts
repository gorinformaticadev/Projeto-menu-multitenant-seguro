import { BackupJobStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationGateway } from '../../notifications/notification.gateway';
import { Notification } from '../../notifications/notification.entity';
import { NotificationService } from '../../notifications/notification.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { CronService } from '../../core/cron/cron.service';
import { SystemTelemetryService } from './system-telemetry.service';
import { RedisLockService } from './redis-lock.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
import { OperationalLoadSheddingService } from './operational-load-shedding.service';

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
  const cronServiceMock = {
    register: jest.fn(),
  };
  const configResolverMock = {
    getBoolean: jest.fn(),
  };
  const distributedOperationalStateServiceMock = {
    getHealth: jest.fn(),
  };
  const operationalLoadSheddingServiceMock = {
    getSnapshot: jest.fn(),
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
  let redisLockMock: {
    acquireLock: jest.Mock<Promise<boolean>, [string, number, string]>;
    releaseLock: jest.Mock<Promise<boolean>, [string, string]>;
    hasCooldown: jest.Mock<Promise<boolean>, [string]>;
    setCooldown: jest.Mock<Promise<void>, [string, number]>;
  };
  let previousEnv: Record<string, string | undefined>;
  let serviceInternals: {
    checkDatabaseHealth: () => Promise<{ status: 'healthy' | 'error'; latencyMs: number | null }>;
    checkRedisHealth: () => Promise<{ status: 'healthy' | 'down'; latencyMs: number | null }>;
  };

  const createService = () =>
    new SystemOperationalAlertsService(
      prismaMock as unknown as PrismaService,
      telemetryService,
      notificationServiceMock as unknown as NotificationService,
      notificationGatewayMock as unknown as NotificationGateway,
      pushNotificationServiceMock as unknown as PushNotificationService,
      auditServiceMock as unknown as AuditService,
      cronServiceMock as unknown as CronService,
      configResolverMock as unknown as ConfigResolverService,
      redisLockMock as unknown as RedisLockService,
      distributedOperationalStateServiceMock as unknown as DistributedOperationalStateService,
      operationalLoadSheddingServiceMock as unknown as OperationalLoadSheddingService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T14:00:00.000Z'));
    telemetryService = new SystemTelemetryService();
    const cooldownState = new Map<string, number>();
    const lockState = new Map<string, string>();
    redisLockMock = {
      acquireLock: jest.fn(async (key: string, _ttlMs: number, ownerId: string) => {
        if (lockState.has(key)) {
          return false;
        }
        lockState.set(key, ownerId);
        return true;
      }),
      releaseLock: jest.fn(async (key: string, ownerId: string) => {
        if (lockState.get(key) !== ownerId) {
          return false;
        }
        lockState.delete(key);
        return true;
      }),
      hasCooldown: jest.fn(async (key: string) => {
        const expiresAt = cooldownState.get(key);
        return Number.isFinite(expiresAt) && Number(expiresAt) > Date.now();
      }),
      setCooldown: jest.fn(async (key: string, durationMs: number) => {
        cooldownState.set(key, Date.now() + durationMs);
      }),
    };
    service = createService();
    serviceInternals = service as unknown as {
      checkDatabaseHealth: () => Promise<{ status: 'healthy' | 'error'; latencyMs: number | null }>;
      checkRedisHealth: () => Promise<{ status: 'healthy' | 'down'; latencyMs: number | null }>;
    };
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
      OPS_ALERT_REDIS_REQUIRED: process.env.OPS_ALERT_REDIS_REQUIRED,
      OPS_ALERT_VERSION_FALLBACK_THRESHOLD: process.env.OPS_ALERT_VERSION_FALLBACK_THRESHOLD,
      OPS_ALERT_RUNTIME_PRESSURE_THRESHOLD: process.env.OPS_ALERT_RUNTIME_PRESSURE_THRESHOLD,
      OPS_ALERT_QUEUE_SATURATION_THRESHOLD: process.env.OPS_ALERT_QUEUE_SATURATION_THRESHOLD,
      OPS_ALERT_CIRCUIT_INSTABILITY_THRESHOLD: process.env.OPS_ALERT_CIRCUIT_INSTABILITY_THRESHOLD,
      OPS_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD:
        process.env.OPS_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD,
    };

    process.env.OPS_ALERT_5XX_RATE_THRESHOLD = '10';
    process.env.OPS_ALERT_WINDOW_MINUTES = '5';
    process.env.OPS_ALERT_MIN_REQUEST_SAMPLE = '25';
    process.env.OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD = '1500';
    process.env.OPS_ALERT_MIN_ROUTE_SAMPLE = '8';
    process.env.OPS_ALERT_DENIED_SPIKE_THRESHOLD = '15';
    process.env.OPS_ALERT_MIN_DENIED_SAMPLE = '12';
    process.env.OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD = '4';
    process.env.OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE = '3';
    process.env.OPS_ALERT_COOLDOWN_MINUTES = '15';
    process.env.OPS_ALERT_REDIS_REQUIRED = 'false';
    process.env.OPS_ALERT_VERSION_FALLBACK_THRESHOLD = '5';
    process.env.OPS_ALERT_RUNTIME_PRESSURE_THRESHOLD = '4';
    process.env.OPS_ALERT_QUEUE_SATURATION_THRESHOLD = '4';
    process.env.OPS_ALERT_CIRCUIT_INSTABILITY_THRESHOLD = '3';
    process.env.OPS_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD = '4';

    notificationServiceMock.createSystemNotificationEntity.mockResolvedValue(baseNotification);
    pushNotificationServiceMock.getPublicKey.mockResolvedValue('public-key');
    prismaMock.backupJob.findMany.mockResolvedValue([]);
    cronServiceMock.register.mockResolvedValue(undefined);
    configResolverMock.getBoolean.mockResolvedValue(true);
    distributedOperationalStateServiceMock.getHealth.mockReturnValue({
      enabled: false,
      mode: 'disabled',
      ready: false,
      fallbackActive: false,
      required: false,
      fallbackMode: 'explicit',
      status: 'disabled',
      detail: null,
    });
    operationalLoadSheddingServiceMock.getSnapshot.mockReturnValue({
      instanceId: 'instance-a',
      instanceCount: 1,
      overloadedInstances: 0,
      adaptiveThrottleFactor: 1,
      desiredAdaptiveThrottleFactor: 1,
      pressureCause: 'normal',
      stateConsistency: 'distributed',
      local: {
        eventLoopLagP95Ms: 10,
        eventLoopLagP99Ms: 15,
        eventLoopLagMaxMs: 20,
        eventLoopUtilization: 0.1,
        heapUsedRatio: 0.3,
        recentApiLatencyMs: 80,
        gcPauseP95Ms: 0,
        gcPauseMaxMs: 0,
        gcEventsRecent: 0,
        queueDepth: 0,
        activeIsolatedRequests: 0,
        pressureScore: 0,
        consecutiveBreaches: 0,
        adaptiveThrottleFactor: 1,
        cause: 'normal',
        overloaded: false,
      },
      clusterRecentApiLatencyMs: 80,
      clusterQueueDepth: 0,
      mitigation: {
        degradeHeavyFeatures: false,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
        featureFlags: [],
        businessImpact: [],
      },
    });
    jest
      .spyOn(serviceInternals, 'checkDatabaseHealth')
      .mockResolvedValue({ status: 'healthy', latencyMs: 12 });
    jest
      .spyOn(serviceInternals, 'checkRedisHealth')
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

  it('registers evaluator job in the dynamic cron runtime on module init', async () => {
    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.operational_alerts_evaluator',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Operational alerts evaluator',
        origin: 'core',
        settingsUrl: '/configuracoes/sistema/cron',
        watchdogEnabled: false,
      }),
    );
  });

  it('applies cooldown to repeated critical alerts', async () => {
    for (let index = 1; index <= 30; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: `/api/users/${index}`,
        durationMs: 220,
        statusCode: index <= 4 ? 500 : 200,
      });
    }

    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledTimes(1);
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledTimes(1);
  });

  it('emits warning alerts as inbox only without push', async () => {
    for (let index = 1; index <= 6; index += 1) {
      telemetryService.recordSecurityEvent({
        type: 'forbidden',
        method: 'GET',
        route: `/api/admin/users/${index}`,
        ip: `10.0.0.${10 + index}`,
        statusCode: 403,
      });
    }
    for (let index = 1; index <= 5; index += 1) {
      telemetryService.recordSecurityEvent({
        type: 'rate_limited',
        method: 'POST',
        route: '/api/auth/login',
        ip: `10.0.1.${10 + index}`,
        statusCode: 429,
      });
    }
    for (let index = 1; index <= 4; index += 1) {
      telemetryService.recordSecurityEvent({
        type: 'unauthorized',
        method: 'GET',
        route: `/api/admin/users/${20 + index}`,
        ip: `10.0.2.${10 + index}`,
        statusCode: 401,
      });
    }

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
    for (let index = 1; index <= 30; index += 1) {
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
      { id: 'job-4', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:55:00.000Z') },
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

  it('does not emit alert for weak 5xx sample below the calibrated threshold', async () => {
    for (let index = 1; index <= 25; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: `/api/invoices/${index}`,
        durationMs: 180,
        statusCode: index <= 2 ? 500 : 200,
      });
    }

    const result = await service.evaluateOperationalAlerts(new Date());

    expect(result.emitted).not.toContain('OPS_HIGH_5XX_ERROR_RATE');
    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
  });

  it('does not emit slow-route alert for low route volume even with high latency', async () => {
    for (let index = 1; index <= 7; index += 1) {
      telemetryService.recordRequest({
        method: 'GET',
        route: `/api/orders/${index}`,
        durationMs: 2_400,
        statusCode: 200,
      });
    }

    const result = await service.evaluateOperationalAlerts(new Date());

    expect(result.emitted).not.toEqual(
      expect.arrayContaining([expect.stringContaining('OPS_CRITICAL_SLOW_ROUTE')]),
    );
    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
  });

  it('does not emit job storm for only three isolated failures', async () => {
    prismaMock.backupJob.findMany.mockResolvedValue([
      { id: 'job-1', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:58:00.000Z') },
      { id: 'job-2', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:57:00.000Z') },
      { id: 'job-3', type: BackupJobStatus.FAILED, finishedAt: new Date('2026-03-07T13:56:00.000Z') },
    ]);

    const result = await service.evaluateOperationalAlerts(new Date());

    expect(result.emitted).not.toContain('OPS_JOB_FAILURE_STORM');
    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
  });

  it('requires consecutive degraded checks before emitting infra alert', async () => {
    const databaseSpy = jest
      .spyOn(serviceInternals, 'checkDatabaseHealth')
      .mockResolvedValue({ status: 'error', latencyMs: null });

    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());

    expect(databaseSpy).toHaveBeenCalledTimes(3);
    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Servico degradado',
        data: expect.objectContaining({
          service: 'database',
          consecutiveChecks: 3,
        }),
      }),
    );
  });

  it('re-emits infra alert only after cooldown when the degradation persists', async () => {
    process.env.OPS_ALERT_REDIS_REQUIRED = 'true';
    jest
      .spyOn(serviceInternals, 'checkRedisHealth')
      .mockResolvedValue({ status: 'down', latencyMs: null });

    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());
    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(16 * 60 * 1000);
    await service.evaluateOperationalAlerts(new Date());

    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledTimes(2);
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledTimes(2);
  });

  it('treats redis as not configured by default when explicit monitoring is disabled', async () => {
    delete process.env.OPS_ALERT_REDIS_REQUIRED;
    const freshService = createService();
    const freshInternals = freshService as unknown as {
      checkRedisHealth: () => Promise<{ status: 'healthy' | 'down' | 'not_configured'; latencyMs: number | null }>;
    };

    const result = await freshInternals.checkRedisHealth();

    expect(result).toEqual({
      status: 'not_configured',
      latencyMs: null,
    });
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

  it('suppresses operational alerts when operations alerts are disabled', async () => {
    configResolverMock.getBoolean.mockResolvedValue(false);

    const emitted = await service.dispatchOperationalAlert({
      action: 'OPS_MANUAL_TEST',
      cooldownKey: 'OPS_MANUAL_TEST',
      severity: 'critical',
      title: 'Teste manual',
      body: 'Alerta operacional manual',
      pushEligible: true,
      audit: true,
      source: 'operational-alerts',
    });

    expect(emitted).toBe(false);
    expect(notificationServiceMock.createSystemNotificationEntity).not.toHaveBeenCalled();
    expect(notificationGatewayMock.emitNewNotification).not.toHaveBeenCalled();
    expect(pushNotificationServiceMock.getPublicKey).not.toHaveBeenCalled();
    expect(auditServiceMock.log).not.toHaveBeenCalled();
  });

  it('emits a correlated operational degradation alert when the same route accumulates multiple failure signals', async () => {
    process.env.OPS_ALERT_RUNTIME_PRESSURE_THRESHOLD = '2';
    process.env.OPS_ALERT_QUEUE_SATURATION_THRESHOLD = '2';
    process.env.OPS_ALERT_CIRCUIT_INSTABILITY_THRESHOLD = '2';
    process.env.OPS_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD = '4';

    telemetryService.recordOperationalEvent({
      type: 'runtime_pressure',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'cpu pressure',
    });
    telemetryService.recordOperationalEvent({
      type: 'runtime_pressure',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'cpu pressure',
    });
    telemetryService.recordOperationalEvent({
      type: 'request_queue_rejected',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 429,
      detail: 'queue full',
    });
    telemetryService.recordOperationalEvent({
      type: 'request_queue_timeout',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'queue wait timeout',
    });
    telemetryService.recordOperationalEvent({
      type: 'circuit_open',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'dependency unstable',
    });
    telemetryService.recordOperationalEvent({
      type: 'circuit_open',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'dependency unstable',
    });
    telemetryService.recordOperationalEvent({
      type: 'request_retry',
      method: 'GET',
      route: '/api/system/dashboard',
      statusCode: 503,
      detail: 'retry transient',
    });

    const result = await service.evaluateOperationalAlerts(new Date());

    expect(result.emitted).toEqual(
      expect.arrayContaining([
        'OPS_RUNTIME_PRESSURE_RECENT',
        'OPS_QUEUE_SATURATION',
        'OPS_CIRCUIT_BREAKER_INSTABILITY',
        'OPS_CORRELATED_OPERATIONAL_DEGRADATION:/api/system/dashboard',
      ]),
    );
    expect(notificationServiceMock.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Degradacao operacional correlacionada',
        data: expect.objectContaining({
          route: '/api/system/dashboard',
          runtimePressureEvents: 2,
          queueSaturationEvents: 2,
          circuitOpenEvents: 2,
          requestRetryEvents: 1,
        }),
      }),
    );
  });
});
