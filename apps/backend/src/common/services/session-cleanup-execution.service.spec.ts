import { PrismaService } from '@core/prisma/prisma.service';
import { MaterializedCronExecutionService } from '@core/cron/materialized-cron-execution.service';
import { SessionCleanupExecutionService } from './session-cleanup-execution.service';
import { SessionCleanupProcessorService } from './session-cleanup-processor.service';

describe('SessionCleanupExecutionService', () => {
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

  it('classifies an overdue slot as not created when the cron dispatched nothing for that slot', async () => {
    const expectedScheduledFor = new Date('2026-03-22T15:00:00.000Z');

    await expect(
      service.inspectExpectedExecution({
        expectedScheduledFor,
        now: new Date('2026-03-22T15:12:00.000Z'),
        staleAfterMs: 5 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: 'not_created',
        isOverdue: true,
        reason: 'slot_not_materialized',
      }),
    );
  });

  it('classifies a running slot as stuck when the execution heartbeat is stale', async () => {
    const runningExecution = createExecution({
      status: 'running',
      heartbeatAt: new Date('2026-03-22T15:00:30.000Z'),
    });
    materializedExecutionServiceMock.getLatestForJob.mockResolvedValue(runningExecution);
    materializedExecutionServiceMock.getBySlot.mockResolvedValue(runningExecution);

    await expect(
      service.inspectExpectedExecution({
        expectedScheduledFor: runningExecution.scheduledFor,
        now: new Date('2026-03-22T15:15:00.000Z'),
        staleAfterMs: 5 * 60 * 1000,
        stuckAfterMs: 10 * 60 * 1000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        state: 'stuck',
        isStuck: true,
        reason: 'running_without_recent_heartbeat',
      }),
    );
  });
});
