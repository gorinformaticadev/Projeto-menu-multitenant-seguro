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
    findRecentOperationalAlerts: jest.fn(),
    resolveOperationalAlerts: jest.fn(),
  };
  const configResolverMock = {
    getBoolean: jest.fn(),
  };
  const redisLockMock = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    isDegraded: jest.fn(),
  };
  const sessionCleanupExecutionServiceMock = {
    inspectExpectedExecution: jest.fn(),
    inspectLatestExecution: jest.fn(),
    inspectExecutionById: jest.fn(),
    listRunningExecutions: jest.fn(),
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
    operationalAlertsServiceMock.findRecentOperationalAlerts.mockResolvedValue([]);
    operationalAlertsServiceMock.resolveOperationalAlerts.mockResolvedValue(0);
    configResolverMock.getBoolean.mockResolvedValue(true);
    redisLockMock.acquireLock.mockResolvedValue(true);
    redisLockMock.releaseLock.mockResolvedValue(undefined);
    redisLockMock.isDegraded.mockReturnValue(false);
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: null,
      latestExecution: null,
      state: 'not_created',
      isOverdue: true,
      isStuck: false,
      reason: 'slot_not_materialized',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: null,
      execution: null,
      latestExecution: null,
      state: 'not_created',
      isOverdue: false,
      isStuck: false,
      reason: 'latest_execution_missing',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectExecutionById.mockResolvedValue({
      expectedScheduledFor: null,
      execution: null,
      latestExecution: null,
      state: 'not_created',
      isOverdue: false,
      isStuck: false,
      reason: 'execution_not_found',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([]);

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
        schedule: '*/15 * * * *',
        now: new Date('2026-03-07T15:10:00.000Z'),
      }),
    );
    expect(sessionCleanupExecutionServiceMock.inspectExpectedExecution.mock.calls[0][0]).not.toHaveProperty(
      'expectedScheduledFor',
    );
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_NOT_RUNNING',
        data: expect.objectContaining({
          jobKey: 'system.session_cleanup',
          executionMode: 'materialized',
          scheduleTimeZone: 'UTC',
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
    const stuckExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
    };
    const stuckSnapshot = {
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: stuckExecution,
      latestExecution: stuckExecution,
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    };
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue(stuckSnapshot);
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue(stuckSnapshot);
    sessionCleanupExecutionServiceMock.inspectExecutionById.mockResolvedValue(stuckSnapshot);

    await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_STUCK_RUNNING',
        cooldownKey: expect.stringContaining('execution-1'),
        data: expect.objectContaining({
          watchdogState: 'stuck',
          materializedExecutionStatus: 'running',
          alertFingerprint: expect.stringContaining('execution-1'),
        }),
      }),
      expect.any(Number),
    );
  });

  it('usa a execucao materializada mais recente como fonte de verdade sem fechar alerta critico antigo so por haver execucao posterior', async () => {
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
      expectedScheduledFor: new Date('2026-03-07T14:45:00.000Z'),
      execution: {
        id: 'execution-stale',
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
      latestExecution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
        status: 'success',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 1n,
        triggeredAt: new Date('2026-03-07T15:00:01.000Z'),
        startedAt: new Date('2026-03-07T15:00:02.000Z'),
        finishedAt: new Date('2026-03-07T15:00:30.000Z'),
        heartbeatAt: new Date('2026-03-07T15:00:30.000Z'),
        lockedUntil: new Date('2026-03-07T15:00:30.000Z'),
        reason: 'completed',
        error: null,
      },
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      latestExecution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      state: 'success',
      isOverdue: false,
      isStuck: false,
      reason: 'success',
      scheduleTimeZone: 'UTC',
    });
    operationalAlertsServiceMock.findRecentOperationalAlerts.mockResolvedValue([
      {
        id: 'notif-stuck-1',
        createdAt: new Date('2026-03-07T14:58:00.000Z'),
        isRead: false,
        readAt: null,
        data: {
          alertAction: 'JOB_STUCK_RUNNING',
          jobKey: 'system.session_cleanup',
          materializedExecutionId: 'execution-stale',
          expectedScheduledFor: '2026-03-07T14:45:00.000Z',
        },
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(sessionCleanupExecutionServiceMock.inspectExpectedExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '*/15 * * * *',
        now: new Date('2026-03-07T15:10:00.000Z'),
      }),
    );
    expect(result).toEqual({
      emitted: [],
      skipped: ['healthy:system.session_cleanup'],
    });
    expect(operationalAlertsServiceMock.resolveOperationalAlerts).not.toHaveBeenCalled();
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('deduplica o mesmo alerta de stuck por fingerprint da execucao', async () => {
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
    const stuckExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
    };
    const stuckSnapshot = {
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: stuckExecution,
      latestExecution: stuckExecution,
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    };
    sessionCleanupExecutionServiceMock.inspectExpectedExecution.mockResolvedValue(stuckSnapshot);
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue(stuckSnapshot);
    sessionCleanupExecutionServiceMock.inspectExecutionById.mockResolvedValue(stuckSnapshot);
    operationalAlertsServiceMock.findRecentOperationalAlerts.mockResolvedValue([
      {
        id: 'notif-stuck-1',
        createdAt: new Date('2026-03-07T15:05:00.000Z'),
        isRead: false,
        readAt: null,
        data: {
          alertAction: 'JOB_STUCK_RUNNING',
          jobKey: 'system.session_cleanup',
          alertFingerprint: 'system.session_cleanup:execution-1',
          materializedExecutionId: 'execution-1',
          expectedScheduledFor: '2026-03-07T14:00:00.000Z',
        },
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['JOB_STUCK_RUNNING:system.session_cleanup:system.session_cleanup:execution-1'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('classifica como suspected_stuck quando a execucao running nao possui heartbeatAt', async () => {
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
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    const runningExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      status: 'running' as const,
      ownerId: 'instance-a',
      attempt: 1,
      leaseVersion: 1n,
      triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
      startedAt: new Date('2026-03-07T14:45:02.000Z'),
      finishedAt: null,
      heartbeatAt: null,
      lockedUntil: new Date('2026-03-07T14:47:03.000Z'),
      reason: null,
      error: null,
    };
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: runningExecution.scheduledFor,
      execution: runningExecution,
      latestExecution: runningExecution,
      state: 'running',
      isOverdue: false,
      isStuck: false,
      reason: 'running_without_heartbeat',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([runningExecution]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(result).toEqual({
      emitted: ['JOB_SUSPECTED_STUCK_RUNNING:system.session_cleanup'],
      skipped: [],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_SUSPECTED_STUCK_RUNNING',
        severity: 'warning',
        data: expect.objectContaining({
          classification: 'suspected_stuck',
          decisionReason: 'missing_heartbeat_evidence',
        }),
      }),
      expect.any(Number),
    );
  });

  it('classifica como suspected_stuck quando a execucao running nao possui lockedUntil', async () => {
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
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    const runningExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      status: 'running' as const,
      ownerId: 'instance-a',
      attempt: 1,
      leaseVersion: 1n,
      triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
      startedAt: new Date('2026-03-07T14:45:02.000Z'),
      finishedAt: null,
      heartbeatAt: new Date('2026-03-07T14:45:03.000Z'),
      lockedUntil: null,
      reason: null,
      error: null,
    };
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: runningExecution.scheduledFor,
      execution: runningExecution,
      latestExecution: runningExecution,
      state: 'running',
      isOverdue: false,
      isStuck: false,
      reason: 'running_without_lease',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([runningExecution]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_SUSPECTED_STUCK_RUNNING',
        severity: 'warning',
        data: expect.objectContaining({
          classification: 'suspected_stuck',
          decisionReason: 'missing_lease_evidence',
        }),
      }),
      expect.any(Number),
    );
  });

  it('gera suspected_stuck quando a coordenacao esta degradada e ha sinais parciais', async () => {
    redisLockMock.isDegraded.mockReturnValue(true);
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
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    const runningExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      status: 'running' as const,
      ownerId: 'instance-a',
      attempt: 1,
      leaseVersion: 1n,
      triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
      startedAt: new Date('2026-03-07T14:45:02.000Z'),
      finishedAt: null,
      heartbeatAt: new Date('2026-03-07T14:45:03.000Z'),
      lockedUntil: new Date('2026-03-07T15:40:00.000Z'),
      reason: null,
      error: null,
    };
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: runningExecution.scheduledFor,
      execution: runningExecution,
      latestExecution: runningExecution,
      state: 'running',
      isOverdue: false,
      isStuck: false,
      reason: 'running_with_active_lease',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([runningExecution]);

    await service.evaluateWatchdog(new Date('2026-03-07T15:30:00.000Z'));

    expect(redisLockMock.acquireLock).not.toHaveBeenCalled();
    expect(sessionCleanupExecutionServiceMock.inspectExecutionById).not.toHaveBeenCalled();
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledTimes(1);
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_SUSPECTED_STUCK_RUNNING',
        severity: 'warning',
        data: expect.objectContaining({
          classification: 'suspected_stuck',
          decisionReason: 'coordination_degraded_insufficient_evidence',
          coordinationDegraded: true,
        }),
      }),
      expect.any(Number),
    );
  });

  it('deduplica o mesmo alerta de suspected_stuck por fingerprint distinto do critico', async () => {
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
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    const runningExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      status: 'running' as const,
      ownerId: 'instance-a',
      attempt: 1,
      leaseVersion: 1n,
      triggeredAt: new Date('2026-03-07T14:45:01.000Z'),
      startedAt: new Date('2026-03-07T14:45:02.000Z'),
      finishedAt: null,
      heartbeatAt: null,
      lockedUntil: new Date('2026-03-07T14:47:03.000Z'),
      reason: null,
      error: null,
    };
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: runningExecution.scheduledFor,
      execution: runningExecution,
      latestExecution: runningExecution,
      state: 'running',
      isOverdue: false,
      isStuck: false,
      reason: 'running_without_heartbeat',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([runningExecution]);
    operationalAlertsServiceMock.findRecentOperationalAlerts.mockResolvedValue([
      {
        id: 'notif-suspected-1',
        createdAt: new Date('2026-03-07T15:05:00.000Z'),
        isRead: false,
        readAt: null,
        data: {
          alertAction: 'JOB_SUSPECTED_STUCK_RUNNING',
          jobKey: 'system.session_cleanup',
          alertFingerprint: 'system.session_cleanup:suspected:execution-1',
          materializedExecutionId: 'execution-1',
        },
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['JOB_SUSPECTED_STUCK_RUNNING:system.session_cleanup:system.session_cleanup:suspected:execution-1'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('revalida a execucao antes de notificar e evita falso positivo por corrida', async () => {
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
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      latestExecution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectExecutionById.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      execution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      latestExecution: {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
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
      state: 'success',
      isOverdue: false,
      isStuck: false,
      reason: 'success',
      scheduleTimeZone: 'UTC',
    });

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:10:00.000Z'));

    expect(result).toEqual({
      emitted: [],
      skipped: ['healthy:system.session_cleanup'],
    });
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('gera suspected_stuck quando uma execucao mais nova existe mas ainda ha execucao antiga running', async () => {
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
      expectedScheduledFor: new Date('2026-03-07T15:15:00.000Z'),
      execution: {
        id: 'execution-2',
        scheduledFor: new Date('2026-03-07T15:15:00.000Z'),
        status: 'success',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 2n,
        triggeredAt: new Date('2026-03-07T15:15:01.000Z'),
        startedAt: new Date('2026-03-07T15:15:02.000Z'),
        finishedAt: new Date('2026-03-07T15:15:05.000Z'),
        heartbeatAt: new Date('2026-03-07T15:15:05.000Z'),
        lockedUntil: new Date('2026-03-07T15:15:05.000Z'),
        reason: 'completed',
        error: null,
      },
      latestExecution: null,
      state: 'success',
      isOverdue: false,
      isStuck: false,
      reason: 'success',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: new Date('2026-03-07T15:15:00.000Z'),
      execution: {
        id: 'execution-2',
        scheduledFor: new Date('2026-03-07T15:15:00.000Z'),
        status: 'success',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 2n,
        triggeredAt: new Date('2026-03-07T15:15:01.000Z'),
        startedAt: new Date('2026-03-07T15:15:02.000Z'),
        finishedAt: new Date('2026-03-07T15:15:05.000Z'),
        heartbeatAt: new Date('2026-03-07T15:15:05.000Z'),
        lockedUntil: new Date('2026-03-07T15:15:05.000Z'),
        reason: 'completed',
        error: null,
      },
      latestExecution: {
        id: 'execution-2',
        scheduledFor: new Date('2026-03-07T15:15:00.000Z'),
        status: 'success',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 2n,
        triggeredAt: new Date('2026-03-07T15:15:01.000Z'),
        startedAt: new Date('2026-03-07T15:15:02.000Z'),
        finishedAt: new Date('2026-03-07T15:15:05.000Z'),
        heartbeatAt: new Date('2026-03-07T15:15:05.000Z'),
        lockedUntil: new Date('2026-03-07T15:15:05.000Z'),
        reason: 'completed',
        error: null,
      },
      state: 'success',
      isOverdue: false,
      isStuck: false,
      reason: 'success',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.listRunningExecutions.mockResolvedValue([
      {
        id: 'execution-1',
        scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
        status: 'running',
        ownerId: 'instance-a',
        attempt: 1,
        leaseVersion: 1n,
        triggeredAt: new Date('2026-03-07T15:00:01.000Z'),
        startedAt: new Date('2026-03-07T15:00:02.000Z'),
        finishedAt: null,
        heartbeatAt: new Date('2026-03-07T15:00:05.000Z'),
        lockedUntil: new Date('2026-03-07T15:10:00.000Z'),
        reason: null,
        error: null,
      },
    ]);
    operationalAlertsServiceMock.findRecentOperationalAlerts.mockResolvedValue([
      {
        id: 'notif-stuck-1',
        createdAt: new Date('2026-03-07T15:00:00.000Z'),
        isRead: false,
        readAt: null,
        data: {
          alertAction: 'JOB_STUCK_RUNNING',
          jobKey: 'system.session_cleanup',
          alertFingerprint: 'system.session_cleanup:execution-1',
          materializedExecutionId: 'execution-1',
          expectedScheduledFor: '2026-03-07T15:00:00.000Z',
        },
      },
    ]);

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:16:00.000Z'));

    expect(result).toEqual({
      emitted: ['JOB_SUSPECTED_STUCK_RUNNING:system.session_cleanup'],
      skipped: [],
    });
    expect(operationalAlertsServiceMock.resolveOperationalAlerts).not.toHaveBeenCalled();
    expect(operationalAlertsServiceMock.dispatchOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_SUSPECTED_STUCK_RUNNING',
        severity: 'warning',
        data: expect.objectContaining({
          classification: 'suspected_stuck',
          decisionReason: 'older_active_orphaned_execution',
          olderRunningExecutionIds: ['execution-1'],
        }),
      }),
      expect.any(Number),
    );
  });

  it('descarta stuck quando a execucao revalidada nao e mais a mais recente', async () => {
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
        nextExpectedRunAt: new Date('2026-03-07T15:00:00.000Z'),
        consecutiveFailureCount: 0,
      },
    ]);
    const initialExecution = {
      id: 'execution-1',
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      status: 'running' as const,
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
    };
    const newerExecution = {
      id: 'execution-2',
      scheduledFor: new Date('2026-03-07T15:15:00.000Z'),
      status: 'success' as const,
      ownerId: 'instance-b',
      attempt: 1,
      leaseVersion: 2n,
      triggeredAt: new Date('2026-03-07T15:15:01.000Z'),
      startedAt: new Date('2026-03-07T15:15:02.000Z'),
      finishedAt: new Date('2026-03-07T15:15:15.000Z'),
      heartbeatAt: new Date('2026-03-07T15:15:15.000Z'),
      lockedUntil: new Date('2026-03-07T15:15:15.000Z'),
      reason: 'completed',
      error: null,
    };
    sessionCleanupExecutionServiceMock.inspectLatestExecution.mockResolvedValue({
      expectedScheduledFor: initialExecution.scheduledFor,
      execution: initialExecution,
      latestExecution: initialExecution,
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    });
    sessionCleanupExecutionServiceMock.inspectExecutionById.mockResolvedValue({
      expectedScheduledFor: initialExecution.scheduledFor,
      execution: initialExecution,
      latestExecution: newerExecution,
      state: 'stuck',
      isOverdue: false,
      isStuck: true,
      reason: 'running_without_recent_heartbeat',
      scheduleTimeZone: 'UTC',
    });

    const result = await service.evaluateWatchdog(new Date('2026-03-07T15:16:00.000Z'));

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
