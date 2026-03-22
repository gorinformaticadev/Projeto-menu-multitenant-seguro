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
  };

  const heartbeatServiceMock = {
    list: jest.fn(),
    get: jest.fn(),
    markScheduled: jest.fn(),
    markStarted: jest.fn(),
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

  const createService = () =>
    new CronService(
      schedulerRegistryMock as unknown as SchedulerRegistry,
      prismaMock as unknown as PrismaService,
      heartbeatServiceMock as unknown as CronJobHeartbeatService,
      redisLockMock as unknown as RedisLockService,
      executionLeaseServiceMock as unknown as ExecutionLeaseService,
    );

  const prepareRegisteredJob = async (
    callback: () => Promise<void> | void = async () => undefined,
    meta: Record<string, unknown> = {},
  ) => {
    prismaMock.cronSchedule.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedRecord)
      .mockResolvedValue(persistedRecord);
    prismaMock.cronSchedule.create.mockResolvedValue(undefined);

    await service.register(
      'system.manual_test',
      '*/5 * * * *',
      callback,
      {
        name: 'Manual test',
        description: 'Runs manually in tests',
        origin: 'core',
        ...meta,
      },
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const job of cronJobs.values()) {
      job.stop?.();
    }
    cronJobs.clear();

    prismaMock.cronSchedule.findMany.mockResolvedValue([]);
    heartbeatServiceMock.list.mockResolvedValue(new Map());
    heartbeatServiceMock.get.mockResolvedValue(null);
    heartbeatServiceMock.markScheduled.mockResolvedValue(undefined);
    heartbeatServiceMock.markStarted.mockResolvedValue(true);
    heartbeatServiceMock.markSuccess.mockResolvedValue(undefined);
    heartbeatServiceMock.markFailure.mockResolvedValue(undefined);
    heartbeatServiceMock.updateHeartbeat.mockResolvedValue(undefined);
    heartbeatServiceMock.reconcileOrphans.mockResolvedValue(undefined);

    redisLockMock.isDegraded.mockReturnValue(false);
    redisLockMock.acquireLock.mockResolvedValue(true);

    executionLeaseServiceMock.acquireLease.mockResolvedValue({ acquired: true, lease: null });
    executionLeaseServiceMock.renewLease.mockResolvedValue(true);
    executionLeaseServiceMock.releaseLease.mockResolvedValue(true);

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

  it('acquires and releases the database lease on a successful cycle', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.acquireLease).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenCalledWith(
      expect.objectContaining({
        jobKey: 'system.manual_test',
        reason: 'completed',
      }),
    );
    expect(heartbeatServiceMock.markStarted).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markSuccess).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markFailure).not.toHaveBeenCalled();
  });

  it('does not execute the callback when a valid database lease already exists', async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    executionLeaseServiceMock.acquireLease.mockResolvedValue({
      acquired: false,
      lease: {
        jobKey: 'system.manual_test',
        ownerId: 'other-instance',
        cycleId: 'existing-cycle',
        lockedUntil: new Date('2026-03-07T10:05:00.000Z'),
      },
    });

    await prepareRegisteredJob(callback, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(callback).not.toHaveBeenCalled();
    expect(heartbeatServiceMock.markStarted).not.toHaveBeenCalled();
    expect(executionLeaseServiceMock.releaseLease).not.toHaveBeenCalled();
  });

  it('releases the database lease when the heartbeat exclusive guard rejects the cycle', async () => {
    heartbeatServiceMock.markStarted.mockResolvedValue(false);

    await prepareRegisteredJob(async () => undefined, {
      databaseLease: {
        enabled: true,
      },
    });

    await service.trigger('system.manual_test');

    expect(executionLeaseServiceMock.acquireLease).toHaveBeenCalledTimes(1);
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenCalledWith(
      expect.objectContaining({
        jobKey: 'system.manual_test',
        reason: 'heartbeat_guard_denied',
      }),
    );
  });

  it('marks the cycle as failed if the completed lease cannot be released safely', async () => {
    executionLeaseServiceMock.releaseLease.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

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
        reason: 'completed',
      }),
    );
    expect(executionLeaseServiceMock.releaseLease).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobKey: 'system.manual_test',
        reason: 'failed',
      }),
    );
  });
});
