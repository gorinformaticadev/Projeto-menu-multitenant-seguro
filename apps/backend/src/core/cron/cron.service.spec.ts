import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';
import { CronService } from './cron.service';

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
  };

  let service: CronService;

  const createService = () =>
    new CronService(
      schedulerRegistryMock as unknown as SchedulerRegistry,
      prismaMock as unknown as PrismaService,
      heartbeatServiceMock as unknown as CronJobHeartbeatService,
    );

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
    heartbeatServiceMock.markStarted.mockResolvedValue(undefined);
    heartbeatServiceMock.markSuccess.mockResolvedValue(undefined);
    heartbeatServiceMock.markFailure.mockResolvedValue(undefined);

    service = createService();
  });

  afterEach(() => {
    for (const job of cronJobs.values()) {
      job.stop?.();
    }
    cronJobs.clear();
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
    prismaMock.cronSchedule.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        modulo: 'system',
        identificador: 'manual_test',
        descricao: 'Manual test',
        expressao: '*/5 * * * *',
        ativo: true,
        origem: 'core',
        editavel: true,
      });
    prismaMock.cronSchedule.create.mockResolvedValue(undefined);

    await service.register(
      'system.manual_test',
      '*/5 * * * *',
      async () => undefined,
      {
        name: 'Manual test',
        description: 'Runs manually in tests',
        origin: 'core',
      },
    );

    await service.trigger('system.manual_test');

    expect(heartbeatServiceMock.markStarted).toHaveBeenCalledTimes(1);
    expect(heartbeatServiceMock.markSuccess).toHaveBeenCalledTimes(1);
  });
});
