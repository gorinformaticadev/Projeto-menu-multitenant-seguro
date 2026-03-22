import { CronService } from '../../core/cron/cron.service';
import { CronJobHeartbeatService } from '../../core/cron/cron-job-heartbeat.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SessionCleanupExecutionService } from './session-cleanup-execution.service';
import { SystemJobWatchdogService } from './system-job-watchdog.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';
import { RedisLockService } from './redis-lock.service';

describe('SystemJobWatchdogService', () => {
  const cronServiceMock = {
    register: jest.fn(),
    getRuntimeJobs: jest.fn(),
    isMaintenancePaused: jest.fn(),
  };
  const heartbeatServiceMock = {
    reconcileOrphans: jest.fn(),
  };
  const operationalAlertsServiceMock = {
    dispatchOperationalAlert: jest.fn(),
  };
  const configResolverMock = {
    getBoolean: jest.fn(),
  };
  const redisLockMock = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };
  const sessionCleanupExecutionServiceMock = {
    inspectExpectedExecution: jest.fn(),
  };

  let service: SystemJobWatchdogService;
  let previousFailureThreshold: string | undefined;

  const createService = () =>
    new SystemJobWatchdogService(
      cronServiceMock as unknown as CronService,
      heartbeatServiceMock as unknown as CronJobHeartbeatService,
      operationalAlertsServiceMock as unknown as SystemOperationalAlertsService,
      configResolverMock as unknown as ConfigResolverService,
      redisLockMock as unknown as RedisLockService,
      sessionCleanupExecutionServiceMock as unknown as SessionCleanupExecutionService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T15:00:00.000Z'));
    previousFailureThreshold = process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD;
    process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD = '3';

    cronServiceMock.register.mockResolvedValue(undefined);
    cronServiceMock.getRuntimeJobs.mockResolvedValue([]);
    cronServiceMock.isMaintenancePaused.mockReturnValue(false);
    heartbeatServiceMock.reconcileOrphans.mockResolvedValue(undefined);
    operationalAlertsServiceMock.dispatchOperationalAlert.mockResolvedValue(true);
    configResolverMock.getBoolean.mockResolvedValue(true);
    redisLockMock.acquireLock.mockResolvedValue(true);
    redisLockMock.releaseLock.mockResolvedValue(undefined);
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: null,
      latestExecution: null,
      state: 'not_created',
      isOverdue: true,
      isStuck: false,
      reason: 'slot_not_materialized',
    });

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (previousFailureThreshold === undefined) {
      delete process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD;
    } else {
      process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD = previousFailureThreshold;
    }
  });

  it('registers the watchdog evaluator in the dynamic cron runtime', async () => {
    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.job_watchdog_evaluator',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Job watchdog evaluator',
        origin: 'core',
        watchdogEnabled: false,
      }),
    );
  });

  it('emits a critical alert for a stale direct job and respects cooldown', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.update_check',
        name: 'Update check',
        description: 'Checks for updates',
        schedule: '0 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'success',
        lastStartedAt: new Date('2026-03-07T12:00:00.000Z'),
        lastSucceededAt: new Date('2026-03-07T12:01:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T13:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));
    await service.evaluateWatchdog(new Date('2026-03-07T15:05:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_NOT_RUNNING',
        pushEligible: true,
        source: 'job-watchdog',
      }),
      expect.any(Number),
    );
  });

  it('emits a critical alert for a materialized session cleanup slot that was never created', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.session_cleanup',
        name: 'Session cleanup',
        description: 'Removes expired sessions',
        schedule: '*/15 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        executionMode: 'materialized',
        lastStatus: 'idle',
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(sessionCleanupExecutionServiceMock.inspectExpectedExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      }),
    );
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_NOT_RUNNING',
        data: expect.objectContaining({
          jobKey: 'system.session_cleanup',
          executionMode: 'materialized',
          watchdogState: 'not_created',
          sourceOfTruth: 'materialized_execution',
          watchdogReason: 'slot_not_materialized',
        }),
      }),
      expect.any(Number),
    );
  });

  it('emits a critical alert for a materialized session cleanup execution that is stuck', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.session_cleanup',
        name: 'Session cleanup',
        description: 'Removes expired sessions',
        schedule: '*/15 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        executionMode: 'materialized',
        lastStatus: 'success',
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: {
        id: 'execution-1',
        status: 'running',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 1n,
        triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
        startedAt: new Date('2026-03-07T14:45:02.000Z'),
        finishedAt: null,
        heartbeatAt: new Date('2026-03-07T14:45:03.000Z'),
        lockedUntil: new Date('2026-03-07T14:47:03.000Z'),
        reason: null,
        error: null,
      },
      latestExecution: null,
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
    });

    await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_STUCK_RUNNING',
        data: expect.objectContaining({
          watchdogState: 'stuck',
          materializedExecutionStatus: 'running',
        }),
      }),
      expect.any(Number),
    );
  });

  it('uses the materialized execution as source of truth for session cleanup instead of the stale aggregate heartbeat', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.session_cleanup',
        name: 'Session cleanup',
        description: 'Removes expired sessions',
        schedule: '*/15 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        executionMode: 'materialized',
        lastStatus: 'running',
        lastStartedAt: new Date('2026-03-07T10:45:00.000Z'),
        lastHeartbeatAt: new Date('2026-03-07T10:45:10.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T11:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: {
        id: 'execution-1',
        status: 'success',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 1n,
        triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
        startedAt: new Date('2026-03-07T14:45:02.000Z'),
        finishedAt: new Date('2026-03-07T14:45:30.000Z'),
        heartbeatAt: new Date('2026-03-07T14:45:30.000Z'),
        lockedUntil: new Date('2026-03-07T14:45:30.000Z'),
        reason: 'completed',
        error: null,
      },
      latestExecution: null,
      state: 'success',
      isOverdue: false,
      isStuck: false,
      reason: 'success',
    });

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(sessionCleanupExecutionServiceMock.inspectExpectedExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      }),
    );
    expect(result).toEqual({
      emitted: [],
      skipped: ['healthy:system.session_cleanup'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('emits a warning for repeated failures without push', async () => {
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.log_cleanup',
        name: 'Log cleanup',
        description: 'Removes old update logs',
        schedule: '0 0 * * 0',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'failed',
        lastStartedAt: new Date('2026-03-07T02:00:00.000Z'),
        lastFailedAt: new Date('2026-03-07T02:05:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-14T00:00:00.000Z'),
        consecutiveFailureCount: 3,
      },
    ]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_REPEATED_FAILURES',
        title: 'Falhas repetidas em job',
        severity: 'warning',
      }),
      expect.any(Number),
    );
  });

  it('skips evaluation while cron jobs are paused for maintenance', async () => {
    cronServiceMock.isMaintenancePaused.mockReturnValue(true);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['maintenance_paused'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('skips watchdog execution entirely when the watchdog toggle is disabled', async () => {
    configResolverMock.getBoolean.mockResolvedValue(false);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['watchdog_disabled'],
    });
    expect(cronServiceMock.getRuntimeJobs).not.toHaveBeenCalled();
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('keeps watchdog execution separate from downstream alert emission', async () => {
    operationalAlertsServiceMock.dispatchOperationalAlert.mockResolvedValue(false);
    cronServiceMock.getRuntimeJobs.mockResolvedValue([
      {
        key: 'system.update_check',
        name: 'Update check',
        description: 'Checks for updates',
        schedule: '0 * * * *',
        enabled: true,
        runtimeRegistered: true,
        runtimeActive: true,
        lastStatus: 'success',
        lastStartedAt: new Date('2026-03-07T12:00:00.000Z'),
        lastSucceededAt: new Date('2026-03-07T12:01:00.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T13:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_NOT_RUNNING',
        source: 'job-watchdog',
      }),
      expect.any(Number),
    );
    expect(result).toEqual({
      emitted: [],
      skipped: ['JOB_NOT_RUNNING:system.update_check'],
    });
  });
});
