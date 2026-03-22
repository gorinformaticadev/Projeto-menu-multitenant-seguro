import { CronService } from '@core/cron/cron.service';
import type { CronJobExecutionContext } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { SessionCleanupExecutionService } from './session-cleanup-execution.service';
import { SessionCleanupProcessorService } from './session-cleanup-processor.service';
import { TokenCleanupService } from './token-cleanup.service';

describe('TokenCleanupService', () => {
  const prismaMock = {
    refreshToken: {
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    trustedDevice: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const cronServiceMock = {
    register: jest.fn(),
  };

  const sessionCleanupExecutionServiceMock = {
    materializeScheduledExecution: jest.fn(),
  };

  const sessionCleanupProcessorMock = {
    cleanupExpiredSessions: jest.fn(),
  };

  const createService = () =>
    new TokenCleanupService(
      prismaMock as unknown as PrismaService,
      cronServiceMock as unknown as CronService,
      sessionCleanupExecutionServiceMock as unknown as SessionCleanupExecutionService,
      sessionCleanupProcessorMock as unknown as SessionCleanupProcessorService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    cronServiceMock.register.mockResolvedValue(undefined);
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.trustedDevice.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));
    sessionCleanupExecutionServiceMock.materializeScheduledExecution.mockResolvedValue({
      id: 'execution-1',
    });
    sessionCleanupProcessorMock.cleanupExpiredSessions.mockResolvedValue(undefined);
  });

  it('registers token cleanup directly and session cleanup in materialized mode', async () => {
    const service = createService();

    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.token_cleanup',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Token cleanup',
        origin: 'core',
        settingsUrl: '/configuracoes/sistema/cron',
        databaseLease: expect.objectContaining({
          enabled: true,
        }),
      }),
    );
    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.session_cleanup',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Session cleanup',
        origin: 'core',
        settingsUrl: '/configuracoes/sistema/cron',
        executionMode: 'materialized',
      }),
    );
  });

  it('materializes the scheduled session cleanup slot instead of running the cleanup inline', async () => {
    const service = createService();

    await service.onModuleInit();

    const sessionRegistration = cronServiceMock.register.mock.calls.find(
      ([key]: [string]) => key === 'system.session_cleanup',
    );
    const callback = sessionRegistration?.[2] as ((context?: CronJobExecutionContext) => Promise<void>) | undefined;
    const context = {
      reason: 'scheduled',
      cycleId: '1774152000000',
      instanceId: 'instance-a',
    } as unknown as CronJobExecutionContext;

    await callback?.(context);

    expect(sessionCleanupExecutionServiceMock.materializeScheduledExecution).toHaveBeenCalledWith(context);
    expect(sessionCleanupProcessorMock.cleanupExpiredSessions).not.toHaveBeenCalled();
  });

  it('delegates the session cleanup business logic to the processor', async () => {
    const service = createService();
    const context = { cycleId: 'cycle-1' } as unknown as CronJobExecutionContext;

    await service.cleanupExpiredSessions(context);

    expect(sessionCleanupProcessorMock.cleanupExpiredSessions).toHaveBeenCalledWith(context);
  });

  it('keeps token cleanup functional with the direct cron path', async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 4 }, { count: 2 }]);

    const service = createService();

    await service.cleanupExpiredTokens();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.trustedDevice.deleteMany).toHaveBeenCalledTimes(1);
  });
});
