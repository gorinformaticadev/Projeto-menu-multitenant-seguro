import { PrismaService } from '@core/prisma/prisma.service';
import { MaterializedCronExecutionService } from '@core/cron/materialized-cron-execution.service';
import { SessionCleanupExecutionService } from './session-cleanup-execution.service';
import { SessionCleanupProcessorService } from './session-cleanup-processor.service';

describe('SessionCleanupExecutionService', () => {
  const saoPauloTimeZone = 'America/Sao_Paulo';
  const utcTimeZone = 'UTC';

  const prismaMock = {
    auditLog: {
      create: jest.fn(),
    },
  };

  const materializedExecutionServiceMock = {
    materializeExecution: jest.fn(),
    claimNextRunnableExecution: jest.fn(),
    renewExecution: jest.fn(),
    finalizeExecution: jest.fn(),
    assertExecutionOwnership: jest.fn(),
    getById: jest.fn(),
    getExecutionAndLatestForJob: jest.fn(),
    getLatestForJob: jest.fn(),
    getBySlot: jest.fn(),
  };

  const processorMock = {
    cleanupExpiredSessions: jest.fn(),
  };

  const createExecution = (overrides: Record<string, unknown> = {}) => ({
    id: 'execution-1',
    jobKey: 'system.session_cleanup',
    scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
    triggeredAt: new Date('2026-03-22T15:00:02.000Z'),
    startedAt: new Date('2026-03-22T15:00:03.000Z'),
    finishedAt: null,
    status: 'running' as const,
    ownerId: 'instance-a',
    attempt: 1,
    leaseVersion: 1n,
    lockedUntil: new Date('2026-03-22T15:02:03.000Z'),
    heartbeatAt: new Date('2026-03-22T15:00:30.000Z'),
    reason: null,
    error: null,
    metadata: {},
    createdAt: new Date('2026-03-22T15:00:02.000Z'),
    updatedAt: new Date('2026-03-22T15:00:30.000Z'),
    ...overrides,
  });

  let service: SessionCleanupExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    materializedExecutionServiceMock.materializeExecution.mockResolvedValue({
      created: true,
      execution: createExecution({
        status: 'pending',
        ownerId: null,
        startedAt: null,
        lockedUntil: null,
        heartbeatAt: null,
        attempt: 0,
        leaseVersion: 0n,
      }),
    });
    materializedExecutionServiceMock.claimNextRunnableExecution.mockResolvedValue(null);
    materializedExecutionServiceMock.renewExecution.mockResolvedValue({
      persisted: true,
      execution: createExecution(),
      reason: null,
    });
    materializedExecutionServiceMock.finalizeExecution.mockResolvedValue({
      persisted: true,
      execution: createExecution({
        status: 'success',
        finishedAt: new Date('2026-03-22T15:00:40.000Z'),
        lockedUntil: new Date('2026-03-22T15:00:40.000Z'),
        heartbeatAt: new Date('2026-03-22T15:00:40.000Z'),
      }),
      reason: null,
    });
    materializedExecutionServiceMock.assertExecutionOwnership.mockResolvedValue({
      owned: true,
      execution: createExecution(),
      reason: null,
    });
    materializedExecutionServiceMock.getById.mockResolvedValue(null);
    materializedExecutionServiceMock.getExecutionAndLatestForJob.mockResolvedValue({
      execution: null,
      latestExecution: null,
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(null);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(null);
    processorMock.cleanupExpiredSessions.mockResolvedValue(undefined);

    service = new SessionCleanupExecutionService(
      prismaMock as unknown as PrismaService,
      materializedExecutionServiceMock as unknown as MaterializedCronExecutionService,
      processorMock as unknown as SessionCleanupProcessorService,
    );
  });

  it('materializes the scheduled slot using jobKey + scheduledFor uniqueness', async () => {
    const context = {
      reason: 'scheduled',
      cycleId: '1774191600000',
      instanceId: 'instance-a',
    } as any;

    await service.materializeScheduledExecution(context);

    expect(materializedExecutionServiceMock.materializeExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        jobKey: 'system.session_cleanup',
        scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
        metadata: expect.objectContaining({
          cronCycleId: '1774191600000',
          cronInstanceId: 'instance-a',
        }),
      }),
    );
  });

  it('claims a pending execution, runs the processor, and finalizes it as success', async () => {
    materializedExecutionServiceMock.claimNextRunnableExecution
      .mockResolvedValueOnce(createExecution())
      .mockResolvedValueOnce(null);

    await expect(service.runWorkerOnce()).resolves.toBe(1);

    expect(processorMock.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
    expect(materializedExecutionServiceMock.finalizeExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 'execution-1',
        ownerId: expect.any(String),
        leaseVersion: 1n,
        status: 'success',
        reason: 'completed',
      }),
    );
  });

  it('aborts the execution when ownership is already lost before the processor runs', async () => {
    materializedExecutionServiceMock.claimNextRunnableExecution
      .mockResolvedValueOnce(createExecution())
      .mockResolvedValueOnce(null);
    materializedExecutionServiceMock.assertExecutionOwnership.mockResolvedValue({
      owned: false,
      execution: createExecution({
        ownerId: 'instance-b',
        leaseVersion: 2n,
      }),
      reason: 'fencing_mismatch',
    });
    materializedExecutionServiceMock.finalizeExecution.mockResolvedValue({
      persisted: true,
      execution: createExecution({
        status: 'aborted',
        finishedAt: new Date('2026-03-22T15:00:20.000Z'),
      }),
      reason: null,
    });

    await expect(service.runWorkerOnce()).resolves.toBe(1);

    expect(processorMock.cleanupExpiredSessions).not.toHaveBeenCalled();
    expect(materializedExecutionServiceMock.finalizeExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'aborted',
        reason: 'ownership_lost',
      }),
    );
  });

  it('keeps a daily materialized job healthy when the expected slot exists with success', async () => {
    const successExecution = createExecution({
      status: 'success',
      scheduledFor: new Date('2026-03-23T11:00:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:00:01.000Z'),
      startedAt: new Date('2026-03-23T11:00:02.000Z'),
      finishedAt: new Date('2026-03-23T11:00:20.000Z'),
      heartbeatAt: new Date('2026-03-23T11:00:20.000Z'),
      lockedUntil: new Date('2026-03-23T11:00:20.000Z'),
      reason: 'completed',
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(successExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(successExecution);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 8 * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T11:20:00.000Z'),
        staleAfterMs: 30 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:00:00.000Z'),
        state: 'success',
        isOverdue: false,
        isStuck: false,
        reason: 'success',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('resolves the expected slot for an hourly schedule using the bounded subdaily policy', async () => {
    await expect(
      service.inspectExpectedExecution({
        schedule: '0 0 * * * *',
        timeZone: utcTimeZone,
        now: new Date('2026-03-23T11:15:00.000Z'),
        staleAfterMs: 60 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:00:00.000Z'),
        state: 'not_created',
        isOverdue: false,
        reason: 'slot_within_materialization_grace',
        scheduleTimeZone: utcTimeZone,
        slotResolutionCadence: 'subdaily',
        slotResolutionMaxOccurrences: 24,
      }),
    );
  });

  it('classifies an overdue daily slot as not created when the correct materialized slot is absent', async () => {
    const previousSuccess = createExecution({
      status: 'success',
      scheduledFor: new Date('2026-03-22T11:00:00.000Z'),
      startedAt: new Date('2026-03-22T11:00:02.000Z'),
      finishedAt: new Date('2026-03-22T11:00:30.000Z'),
      heartbeatAt: new Date('2026-03-22T11:00:30.000Z'),
      lockedUntil: new Date('2026-03-22T11:00:30.000Z'),
      reason: 'completed',
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(previousSuccess);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 8 * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T12:00:00.000Z'),
        staleAfterMs: 30 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:00:00.000Z'),
        state: 'not_created',
        isOverdue: true,
        reason: 'slot_not_materialized',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('resolves the expected slot for a weekly schedule using the bounded weekly policy', async () => {
    await expect(
      service.inspectExpectedExecution({
        schedule: '0 8 * * 1',
        timeZone: utcTimeZone,
        now: new Date('2026-03-26T12:00:00.000Z'),
        staleAfterMs: 7 * 24 * 60 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T08:00:00.000Z'),
        state: 'not_created',
        isOverdue: false,
        reason: 'slot_within_materialization_grace',
        scheduleTimeZone: utcTimeZone,
        slotResolutionCadence: 'weekly',
        slotResolutionMaxOccurrences: 12,
      }),
    );
  });

  it('resolves the expected slot for a monthly schedule using the bounded monthly policy', async () => {
    await expect(
      service.inspectExpectedExecution({
        schedule: '0 8 1 * *',
        timeZone: utcTimeZone,
        now: new Date('2026-03-23T12:00:00.000Z'),
        staleAfterMs: 40 * 24 * 60 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-01T08:00:00.000Z'),
        state: 'not_created',
        isOverdue: false,
        reason: 'slot_within_materialization_grace',
        scheduleTimeZone: utcTimeZone,
        slotResolutionCadence: 'monthly',
        slotResolutionMaxOccurrences: 18,
      }),
    );
  });

  it('keeps a pending slot healthy while it is still within the materialization grace window', async () => {
    const pendingExecution = createExecution({
      status: 'pending',
      scheduledFor: new Date('2026-03-23T11:10:00.000Z'),
      startedAt: null,
      finishedAt: null,
      heartbeatAt: null,
      lockedUntil: null,
      ownerId: null,
      attempt: 0,
      leaseVersion: 0n,
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(pendingExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(pendingExecution);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 * * * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T11:10:30.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:10:00.000Z'),
        state: 'pending',
        isOverdue: false,
        reason: 'pending',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('returns an explicit resolution error for an invalid cron expression', async () => {
    await expect(
      service.inspectExpectedExecution({
        schedule: 'invalid cron',
        timeZone: utcTimeZone,
        now: new Date('2026-03-23T12:00:00.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: null,
        state: 'not_created',
        isOverdue: false,
        reason: 'expected_slot_resolution_failed',
        scheduleTimeZone: utcTimeZone,
        slotResolutionErrorCode: 'invalid_schedule',
        slotResolutionError: expect.stringContaining('Falha ao interpretar schedule'),
      }),
    );
  });

  it('returns an explicit resolution error for yearly schedules outside the supported policy window', async () => {
    await expect(
      service.inspectExpectedExecution({
        schedule: '0 8 1 1 *',
        timeZone: utcTimeZone,
        now: new Date('2026-03-23T12:00:00.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: null,
        state: 'not_created',
        isOverdue: false,
        reason: 'expected_slot_resolution_failed',
        scheduleTimeZone: utcTimeZone,
        slotResolutionErrorCode: 'unsupported_schedule_interval',
        slotResolutionError: expect.stringContaining('politica suportada'),
      }),
    );
  });

  it('flags a pending slot when it remains pending past the grace window', async () => {
    const pendingExecution = createExecution({
      status: 'pending',
      scheduledFor: new Date('2026-03-23T11:10:00.000Z'),
      startedAt: null,
      finishedAt: null,
      heartbeatAt: null,
      lockedUntil: null,
      ownerId: null,
      attempt: 0,
      leaseVersion: 0n,
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(pendingExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(pendingExecution);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 * * * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T11:12:00.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:10:00.000Z'),
        state: 'pending',
        isOverdue: true,
        reason: 'pending_past_expected_window',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('keeps a running slot healthy while heartbeat and lock are still current', async () => {
    const runningExecution = createExecution({
      status: 'running',
      scheduledFor: new Date('2026-03-23T11:10:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:10:01.000Z'),
      startedAt: new Date('2026-03-23T11:10:02.000Z'),
      heartbeatAt: new Date('2026-03-23T11:10:40.000Z'),
      lockedUntil: new Date('2026-03-23T11:12:10.000Z'),
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(runningExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(runningExecution);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 * * * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T11:11:30.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 90 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:10:00.000Z'),
        state: 'running',
        isStuck: false,
        reason: 'running_with_recent_heartbeat',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('classifies a running slot as stuck when the execution heartbeat is stale and the lease is expired', async () => {
    const runningExecution = createExecution({
      status: 'running',
      scheduledFor: new Date('2026-03-23T11:10:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:10:01.000Z'),
      startedAt: new Date('2026-03-23T11:10:02.000Z'),
      heartbeatAt: new Date('2026-03-23T11:10:30.000Z'),
      lockedUntil: new Date('2026-03-23T11:11:00.000Z'),
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(runningExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(runningExecution);

    await expect(
      service.inspectExpectedExecution({
        schedule: '0 * * * * *',
        timeZone: saoPauloTimeZone,
        now: new Date('2026-03-23T11:13:00.000Z'),
        staleAfterMs: 60 * 1000,
        stuckAfterMs: 90 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:10:00.000Z'),
        state: 'stuck',
        isStuck: true,
        reason: 'running_without_recent_heartbeat',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('nao classifica como stuck uma execucao terminal curta apenas por falta de heartbeat continuo', async () => {
    const successExecution = createExecution({
      id: 'execution-2',
      status: 'success',
      scheduledFor: new Date('2026-03-23T11:15:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:15:00.050Z'),
      startedAt: new Date('2026-03-23T11:15:00.060Z'),
      finishedAt: new Date('2026-03-23T11:15:00.090Z'),
      heartbeatAt: new Date('2026-03-23T11:15:00.090Z'),
      lockedUntil: new Date('2026-03-23T11:15:00.090Z'),
      reason: 'completed',
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(successExecution);

    await expect(
      service.inspectLatestExecution({
        now: new Date('2026-03-23T11:20:00.000Z'),
        stuckAfterMs: 90 * 1000,
        timeZone: saoPauloTimeZone,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:15:00.000Z'),
        state: 'success',
        isStuck: false,
        reason: 'success',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('nao classifica como stuck uma execucao running sem heartbeat persistido', async () => {
    const runningExecution = createExecution({
      id: 'execution-3',
      status: 'running',
      scheduledFor: new Date('2026-03-23T11:20:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:20:01.000Z'),
      startedAt: new Date('2026-03-23T11:20:02.000Z'),
      heartbeatAt: null,
      lockedUntil: new Date('2026-03-23T11:21:00.000Z'),
      finishedAt: null,
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(runningExecution);

    await expect(
      service.inspectLatestExecution({
        now: new Date('2026-03-23T11:23:00.000Z'),
        stuckAfterMs: 90 * 1000,
        timeZone: saoPauloTimeZone,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:20:00.000Z'),
        state: 'running',
        isStuck: false,
        reason: 'running_without_heartbeat',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });

  it('nao classifica como stuck uma execucao running com heartbeat stale mas lease ausente', async () => {
    const runningExecution = createExecution({
      id: 'execution-4',
      status: 'running',
      scheduledFor: new Date('2026-03-23T11:25:00.000Z'),
      triggeredAt: new Date('2026-03-23T11:25:01.000Z'),
      startedAt: new Date('2026-03-23T11:25:02.000Z'),
      heartbeatAt: new Date('2026-03-23T11:25:10.000Z'),
      lockedUntil: null,
      finishedAt: null,
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(runningExecution);

    await expect(
      service.inspectLatestExecution({
        now: new Date('2026-03-23T11:28:00.000Z'),
        stuckAfterMs: 90 * 1000,
        timeZone: saoPauloTimeZone,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        expectedScheduledFor: new Date('2026-03-23T11:25:00.000Z'),
        state: 'running',
        isStuck: false,
        reason: 'running_without_lease',
        scheduleTimeZone: saoPauloTimeZone,
      }),
    );
  });
});
