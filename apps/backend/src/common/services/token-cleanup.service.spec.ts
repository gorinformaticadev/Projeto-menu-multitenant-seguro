import { CronService } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
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
    userSession: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const cronServiceMock = {
    register: jest.fn(),
  };

  const createService = () =>
    new TokenCleanupService(
      prismaMock as unknown as PrismaService,
      cronServiceMock as unknown as CronService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    cronServiceMock.register.mockResolvedValue(undefined);
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.trustedDevice.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.userSession.findMany.mockResolvedValue([]);
    prismaMock.userSession.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));
  });

  it('registers token and session cleanup jobs with database lease enabled', async () => {
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
        databaseLease: expect.objectContaining({
          enabled: true,
        }),
      }),
    );
  });

  it('removes expired sessions in batches until no more rows remain', async () => {
    prismaMock.userSession.findMany
      .mockResolvedValueOnce([{ id: 'session-1' }, { id: 'session-2' }])
      .mockResolvedValueOnce([{ id: 'session-3' }])
      .mockResolvedValueOnce([]);
    prismaMock.userSession.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const service = createService();

    await service.cleanupExpiredSessions();

    expect(prismaMock.userSession.findMany).toHaveBeenCalledTimes(3);
    expect(prismaMock.userSession.deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ['session-1', 'session-2'] },
      },
    });
    expect(prismaMock.userSession.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ['session-3'] },
      },
    });
  });

  it('aborts session cleanup when lease ownership is lost between batches', async () => {
    prismaMock.userSession.findMany.mockResolvedValueOnce([{ id: 'session-1' }]);
    prismaMock.userSession.deleteMany.mockResolvedValueOnce({ count: 1 });

    const executionContext = {
      throwIfAborted: jest.fn(),
      assertLeaseOwnership: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('LEASE_LOST')),
    };

    const service = createService();

    await expect(service.cleanupExpiredSessions(executionContext as never)).rejects.toThrow('LEASE_LOST');
    expect(prismaMock.userSession.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('keeps token cleanup functional without advisory locks in the service layer', async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 4 }, { count: 2 }]);

    const service = createService();

    await service.cleanupExpiredTokens();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.trustedDevice.deleteMany).toHaveBeenCalledTimes(1);
  });
});
