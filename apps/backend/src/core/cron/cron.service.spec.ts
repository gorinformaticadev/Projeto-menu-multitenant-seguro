import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';
import { CronService } from './cron.service';
import { RedisLockService } from '../../common/services/redis-lock.service';
import { ExecutionLeaseService } from './execution-lease.service';

describe('CronService', () => {
  type StoredCronJob = {
    stop?: () => void;
  };

  const cronJobs = new Map<string, StoredCronJob>();
  const schedulerRegistryMock = {
    addCronJob: jest.fn((name: string, job: StoredCronJob) => {
      cronJobs.set(name, job);
    }),
    deleteCronJob: jest.fn((name: string) => {
      const job = cronJobs.get(name);
      if (job) {
        job.stop?.();
      }
      cronJobs.delete(name);
    }),
    doesExist: jest.fn((_type: string, name: string) => cronJobs.has(name)),
    getCronJobs: jest.fn(() => cronJobs),
  };

  const prismaMock = {
    cronSchedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const heartbeatServiceMock = {
    list: jest.fn(),
    get: jest.fn(),
    markScheduled: jest.fn(),
    markStarted: jest.fn(),
    markSkipped: jest.fn(),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
    updateHeartbeat: jest.fn(),
    reconcileOrphans: jest.fn(),
  };

  const redisLockMock = {
    isDegraded: jest.fn(),
    acquireLock: jest.fn(),
  };

  const executionLeaseServiceMock = {
    acquireLease: jest.fn(),
    renewLease: jest.fn(),
    releaseLease: jest.fn(),
    assertLeaseOwnership: jest.fn(),
    get: jest.fn(),
  };

  let service: CronService;

  const persistedRecord = {
    modulo: 'system',
    identificador: 'manual_test',
    descricao: 'Manual test',
    expressao: '*/5 * * * *',
    ativo: true,
    origem: 'core',
    editavel: true,
  };

  const buildLease = (overrides: Record<string, unknown> = {}) => {
    const baseTime = new Date('2026-03-07T10:00:00.000Z');
    return {
      jobKey: 'system.manual_test',
      ownerId: 'instance-a',
      cycleId: 'cycle-1',
      leaseVersion: 1n,
      status: 'active',
      startedAt: baseTime,
      heartbeatAt: baseTime,
      lockedUntil: new Date('2026-03-07T10:02:00.000Z'),
      acquiredAt: baseTime,
      releasedAt: null,
      releaseReason: null,
      lastError: null,
      createdAt: baseTime,
      updatedAt: baseTime,
      ...overrides,
    };
  };

  const buildHeartbeat = (overrides: Record<string, unknown> = {}) => {
    const baseTime = new Date('2026-03-07T10:00:00.000Z');
    return {
      jobKey: 'system.manual_test',
      lastStartedAt: baseTime,
      lastHeartbeatAt: baseTime,
      lastSucceededAt: null,
      lastFailedAt: null,
      lastDurationMs: 10,
      lastStatus: 'running',
      lastError: null,
      nextExpectedRunAt: new Date('2026-03-07T10:05:00.000Z'),
      consecutiveFailureCount: 0,
      updatedAt: baseTime,
      cycleId: 'cycle-1',
      instanceId: 'instance-a',
      ...overrides,
    };
  };

  const buildMaterializedExecution = (overrides: Record<string, unknown> = {}) => {
    const scheduledFor = new Date('2026-03-07T10:00:00.000Z');
    const startedAt = new Date('2026-03-07T10:00:03.000Z');
    const finishedAt = new Date('2026-03-07T10:00:13.000Z');

    return {
      jobKey: 'system.manual_test',
      scheduledFor,
      triggeredAt: new Date('2026-03-07T10:00:02.000Z'),
      startedAt,
      finishedAt,
      status: 'success',
      heartbeatAt: new Date('2026-03-07T10:00:10.000Z'),
      reason: 'completed',
      error: null,
      updatedAt: finishedAt,
      ...overrides,
    };
  };

  const createService = () =>
    new CronService(
      schedulerRegistryMock as unknown as SchedulerRegistry,
      prismaMock as unknown as PrismaService,
      heartbeatServiceMock as unknown as CronJobHeartbeatService,
      redisLockMock as unknown as RedisLockService,
      executionLeaseServiceMock as unknown as ExecutionLeaseService,
    );

  const prepareRegisteredJob = async (
    callback: (context?: unknown) => Promise<void> | void = async () => undefined,
    meta: Record<string, unknown> = {},
  ) => {
    prismaMock.cronSchedule.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedRecord)
      .mockResolvedValue(persistedRecord);
    prismaMock.cronSchedule.create.mockResolvedValue(undefined);

    await service.register('system.manual_test', '*/5 * * * *', callback, {
      name: 'Manual test',
      description: 'Runs manually in tests',
      origin: 'core',
      ...meta,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const job of cronJobs.values()) {
      job.stop?.();
    }
    cronJobs.clear();

    prismaMock.cronSchedule.findMany.mockResolvedValue([]);
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.$queryRaw.mockResolvedValue([]);
    heartbeatServiceMock.list.mockResolvedValue(new Map());
    heartbeatServiceMock.get.mockResolvedValue(null);
    heartbeatServiceMock.markScheduled.mockResolvedValue(undefined);
    heartbeatServiceMock.markStarted.mockResolvedValue(true);
    heartbeatServiceMock.markSkipped.mockResolvedValue({ persisted: true, reason: null });
    heartbeatServiceMock.markSuccess.mockResolvedValue({ persisted: true, reason: null });
    heartbeatServiceMock.markFailure.mockResolvedValue({ persisted: true, reason: null });
    heartbeatServiceMock.updateHeartbeat.mockResolvedValue(true);
    heartbeatServiceMock.reconcileOrphans.mockResolvedValue(undefined);

    redisLockMock.isDegraded.mockReturnValue(false);
    redisLockMock.acquireLock.mockResolvedValue(true);

    executionLeaseServiceMock.acquireLease.mockResolvedValue({
      acquired: true,
      lease: buildLease(),
    });
    executionLeaseServiceMock.renewLease.mockResolvedValue({
      renewed: true,
      lease: buildLease(),
      reason: null,
    });
    executionLeaseServiceMock.releaseLease.mockResolvedValue({
      released: true,
      lease: buildLease({
        status: 'released',
        releasedAt: new Date('2026-03-07T10:01:00.000Z'),
      }),
      reason: null,
    });
    executionLeaseServiceMock.assertLeaseOwnership.mockResolvedValue({
      owned: true,
      lease: buildLease(),
      reason: null,
    });
    executionLeaseServiceMock.get.mockResolvedValue(buildLease());

    service = createService();
  });

  afterEach(() => {
    for (const job of cronJobs.values()) {
      job.stop?.();
    }
    cronJobs.clear();
    jest.useRealTimers();
  });

  it('shows persisted jobs that are missing runtime registration', async () => {
    prismaMock.cronSchedule.findMany.mockResolvedValue([
      {
        modulo: 'system',
        identificador: 'orphan_job',
        descricao: 'Persisted only',
        expressao: '0 * * * *',
        ativo: true,
        origem: 'core',
        editavel: true,
      },
    ]);
    heartbeatServiceMock.list.mockResolvedValue(
      new Map([
        [
          'system.orphan_job',
          {
            jobKey: 'system.orphan_job',
            lastStartedAt: new Date('2026-03-07T10:00:00.000Z'),
            lastSucceededAt: null,
            lastFailedAt: new Date('2026-03-07T10:01:00.000Z'),
            lastDurationMs: 1000,
            lastStatus: 'failed',
            lastError: 'Falha',
            nextExpectedRunAt: new Date('2026-03-07T11:00:00.000Z'),
            consecutiveFailureCount: 1,
            updatedAt: new Date('2026-03-07T10:01:00.000Z'),
          },
        ],
      ]),
    );

    await service.onModuleInit();
    const jobs = await service.listJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        key: 'system.orphan_job',
        runtimeRegistered: false,
        issue: 'runtime_not_registered',
        lastStatus: 'failed',
      }),
    );
  });

  it('updates heartbeat when a registered job is triggered manually', async () => {
    await prepareRegisteredJob();

    await service.trigger('system.manual_test');

    expect(heartbeatServiceMock.markStarted).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markSuccess).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
  });

  it('dispatches materialized jobs without entering the generic heartbeat or lease lifecycle', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);

    await prepareRegisteredJob(callback, {
      executionMode: 'materialized',
    });

    await service.trigger('system.manual_test');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markStarted).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markSuccess).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
    expect(executionLeaseServiceMock.acquireLease).not.toHaveBeenCalled();
    expect(redisLockMock.acquireLock).not.toHaveBeenCalled();
  });

  it('uses materialized executions as the operational source for runtime snapshots', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T15:00:00.000Z'));

    await prepareRegisteredJob(async () => undefined, {
      executionMode: 'materialized',
    });

    const latestSuccess = buildMaterializedExecution({
      scheduledFor: new Date('2026-03-07T14:45:00.000Z'),
      triggeredAt: new Date('2026-03-07T14:45:02.000Z'),
      startedAt: new Date('2026-03-07T14:45:05.000Z'),
      heartbeatAt: new Date('2026-03-07T14:45:15.000Z'),
      finishedAt: new Date('2026-03-07T14:45:20.000Z'),
      updatedAt: new Date('2026-03-07T14:45:20.000Z'),
      status: 'success',
    });

    prismaMock.$queryRaw
      .mockResolvedValueOnce([latestSuccess])
      .mockResolvedValueOnce([latestSuccess])
      .mockResolvedValueOnce([]);

    const jobs = await service.getRuntimeJobs();

    expect(heartbeatServiceMock.list).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        key: 'system.manual_test',
        executionMode: 'materialized',
        lastStatus: 'success',
        lastStartedAt: new Date('2026-03-07T14:45:05.000Z'),
        lastSucceededAt: new Date('2026-03-07T14:45:20.000Z'),
        lastDurationMs: 15000,
        nextExpectedRunAt: new Date('2026-03-07T15:05:00.000Z'),
      }),
    );
  });

  it('derives lastSucceededAt for materialized jobs from materialized execution history', async () => {
    await prepareRegisteredJob(async () => undefined, {
      executionMode: 'materialized',
    });

    const latestRunning = buildMaterializedExecution({
      scheduledFor: new Date('2026-03-07T15:00:00.000Z'),
      triggeredAt: new Date('2026-03-07T15:00:02.000Z'),
      startedAt: new Date('2026-03-07T15:00:04.000Z'),
      finishedAt: null,
      heartbeatAt: new Date('2026-03-07T15:00:19.000Z'),
      updatedAt: new Date('2026-03-07T15:00:19.000Z'),
      status: 'running',
    });
    const previousSuccess = buildMaterializedExecution({
      scheduledFor: new Date('2026-03-07T14:45:00.000Z'),
      triggeredAt: new Date('2026-03-07T14:45:02.000Z'),
      startedAt: new Date('2026-03-07T14:45:05.000Z'),
      heartbeatAt: new Date('2026-03-07T14:45:11.000Z'),
      finishedAt: new Date('2026-03-07T14:45:12.000Z'),
      updatedAt: new Date('2026-03-07T14:45:12.000Z'),
      status: 'success',
    });

    prismaMock.$queryRaw
      .mockResolvedValueOnce([latestRunning])
      .mockResolvedValueOnce([previousSuccess])
      .mockResolvedValueOnce([]);

    const [job] = await service.getRuntimeJobs();

    expect(job).toEqual(
      expect.objectContaining({
        executionMode: 'materialized',
        lastStatus: 'running',
        lastStartedAt: new Date('2026-03-07T15:00:04.000Z'),
        lastSucceededAt: new Date('2026-03-07T14:45:12.000Z'),
        lastDurationMs: 15000,
      }),
    );
  });

  it('keeps heartbeat as the operational source for non-materialized runtime snapshots', async () => {
    await prepareRegisteredJob();

    heartbeatServiceMock.list.mockResolvedValue(
      new Map([
        [
          'system.manual_test',
          buildHeartbeat({
            lastStatus: 'success',
            lastStartedAt: new Date('2026-03-07T11:00:00.000Z'),
            lastSucceededAt: new Date('2026-03-07T11:00:08.000Z'),
            nextExpectedRunAt: new Date('2026-03-07T11:05:00.000Z'),
          }),
        ],
      ]),
    );

    const [job] = await service.getRuntimeJobs();

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(job).toEqual(
      expect.objectContaining({
        executionMode: 'direct',
        lastStatus: 'success',
        lastStartedAt: new Date('2026-03-07T11:00:00.000Z'),
        lastSucceededAt: new Date('2026-03-07T11:00:08.000Z'),
        nextExpectedRunAt: new Date('2026-03-07T11:05:00.000Z'),
      }),
    );
  });

  it('acquires and releases the database lease on a successful cycle', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markStarted.mock.invocationCallOrder[0]).toBeLessThan(
      executionLeaseServiceMock.acquireLease.mock.invocationCallOrder[0],
    );
    expect(executionLeaseServiceMock.acquireLease).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.assertLeaseOwnership).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenCalledWith(
      expect.objectContaining({
        jobKey: 'system.manual_test',
        leaseVersion: 1n,
        reason: 'completed',
      }),
    );
    expect(heartbeatServiceMock.markStarted).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markSkipped).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markSuccess).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('records the cycle as skipped when a valid database lease already exists', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    executionLeaseServiceMock.acquireLease.mockResolvedValue({
      acquired: false,
      lease: buildLease({
        ownerId: 'other-instance',
        cycleId: 'existing-cycle',
        leaseVersion: 4n,
        lockedUntil: new Date('2026-03-07T10:05:00.000Z'),
      }),
    });

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(callback).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markStarted).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markSkipped).toHaveBeenCalledWith(
      'system.manual_test',
      expect.any(Date),
      expect.any(Date),
      expect.stringContaining('DB_LEASE_DENIED ownerId=other-instance'),
      expect.any(Date),
      expect.any(String),
      expect.any(String),
    );
    expect(executionLeaseServiceMock.releaseLease).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markSuccess).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
  });

  it('records the cycle as skipped when the cycle lock is denied before execution', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    redisLockMock.acquireLock.mockResolvedValue(false);

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(callback).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markStarted).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markSkipped).toHaveBeenCalledWith(
      'system.manual_test',
      expect.any(Date),
      expect.any(Date),
      'LOCK_DENIED',
      expect.any(Date),
      expect.any(String),
      expect.any(String),
    );
    expect(executionLeaseServiceMock.acquireLease).not.toHaveBeenCalled();
  });

  it('records the cycle as skipped when the heartbeat exclusive guard rejects the cycle', async () => {
    heartbeatServiceMock.markStarted.mockResolvedValue(false);

    await prepareRegisteredJob(async () => undefined, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(executionLeaseServiceMock.acquireLease).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markSkipped).toHaveBeenCalledWith(
      'system.manual_test',
      expect.any(Date),
      expect.any(Date),
      'HEARTBEAT_GUARD_DENIED',
      expect.any(Date),
      expect.any(String),
      expect.any(String),
    );
  });

  it('marks the cycle as failed if the completed lease cannot be released safely', async () => {
    executionLeaseServiceMock.releaseLease
      .mockResolvedValueOnce({
        released: false,
        lease: buildLease(),
        reason: 'database_error',
      })
      .mockResolvedValueOnce({
        released: true,
        lease: buildLease({
          status: 'released',
          releasedAt: new Date('2026-03-07T10:01:00.000Z'),
        }),
        reason: null,
      });

    await prepareRegisteredJob(async () => undefined, {
      databaseLease: {
        enabled: true,
      },
    });

    await expect(service.trigger('system.manual_test')).rejects.toThrow(
      'Lease persistido de system.manual_test nao foi liberado',
    );

    expect(heartbeatServiceMock.markSuccess).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markFailure).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobKey: 'system.manual_test',
        leaseVersion: 1n,
        reason: 'completed',
      }),
    );
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobKey: 'system.manual_test',
        leaseVersion: 1n,
        reason: 'failed',
      }),
    );
  });

  it('persists a superseded terminal fallback when markSuccess loses ownership', async () => {
    heartbeatServiceMock.markSuccess.mockResolvedValue({
      persisted: false,
      reason: 'stale_execution',
    });

    await prepareRegisteredJob(async () => undefined, {
      databaseLease: {
        enabled: true,
      },
    });

    heartbeatServiceMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'other-cycle',
          instanceId: 'other-instance',
        }),
      )
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'other-cycle',
          instanceId: 'other-instance',
        }),
      );

    await expect(service.trigger('system.manual_test')).resolves.toBeUndefined();

    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CRON_CYCLE_TERMINAL_FALLBACK',
          metadata: expect.objectContaining({
            intendedTerminalStatus: 'success',
            persistedTerminalStatus: 'superseded',
          }),
        }),
      }),
    );
  });

  it('falls back to failed heartbeat persistence when markSuccess hits database_error', async () => {
    heartbeatServiceMock.markSuccess.mockResolvedValue({
      persisted: false,
      reason: 'database_error',
    });

    await prepareRegisteredJob(async () => undefined, {
      databaseLease: {
        enabled: true,
      },
    });

    heartbeatServiceMock.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(service.trigger('system.manual_test')).resolves.toBeUndefined();

    expect(heartbeatServiceMock.markFailure).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('persists a superseded terminal fallback when markFailure loses ownership', async () => {
    const callback = jest.fn().mockRejectedValue(new Error('boom'));
    heartbeatServiceMock.markFailure.mockResolvedValue({
      persisted: false,
      reason: 'stale_execution',
    });

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    heartbeatServiceMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'other-cycle',
          instanceId: 'other-instance',
        }),
      )
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'other-cycle',
          instanceId: 'other-instance',
        }),
      );

    await expect(service.trigger('system.manual_test')).rejects.toThrow('boom');

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CRON_CYCLE_TERMINAL_FALLBACK',
          metadata: expect.objectContaining({
            intendedTerminalStatus: 'failed',
            persistedTerminalStatus: 'superseded',
          }),
        }),
      }),
    );
  });

  it('aborts stale execution when fencing token ownership is lost during callback processing', async () => {
    const callback = jest.fn(async (context?: { assertLeaseOwnership?: (stage?: string) => Promise<void> }) => {
      await context?.assertLeaseOwnership?.('mid_batch');
    });

    executionLeaseServiceMock.assertLeaseOwnership
      .mockResolvedValueOnce({
        owned: true,
        lease: buildLease(),
        reason: null,
      })
      .mockResolvedValueOnce({
        owned: false,
        lease: buildLease({
          ownerId: 'other-instance',
          cycleId: 'cycle-2',
          leaseVersion: 2n,
        }),
        reason: 'fencing_mismatch',
      });

    heartbeatServiceMock.markFailure.mockResolvedValue({
      persisted: false,
      reason: 'stale_execution',
    });

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    heartbeatServiceMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'cycle-2',
          instanceId: 'other-instance',
        }),
      )
      .mockResolvedValueOnce(
        buildHeartbeat({
          cycleId: 'cycle-2',
          instanceId: 'other-instance',
        }),
      );

    await expect(service.trigger('system.manual_test')).rejects.toThrow(
      'Lease persistido de system.manual_test foi perdido',
    );

    expect(heartbeatServiceMock.markSuccess).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markFailure).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.releaseLease).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CRON_CYCLE_TERMINAL_FALLBACK',
          metadata: expect.objectContaining({
            intendedTerminalStatus: 'failed',
            persistedTerminalStatus: 'superseded',
          }),
        }),
      }),
    );
  });
});
