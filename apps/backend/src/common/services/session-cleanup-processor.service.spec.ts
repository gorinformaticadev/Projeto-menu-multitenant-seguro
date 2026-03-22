import type { CronJobExecutionContext } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { SessionCleanupProcessorService } from './session-cleanup-processor.service';

describe('SessionCleanupProcessorService', () => {
  const prismaMock = {
    userSession: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  let service: SessionCleanupProcessorService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.userSession.findMany.mockResolvedValue([]);
    prismaMock.userSession.deleteMany.mockResolvedValue({ count: 0 });
    service = new SessionCleanupProcessorService(prismaMock as unknown as PrismaService);
  });

  it('removes expired sessions in batches until there are no more rows', async () => {
    prismaMock.userSession.findMany
      .mockResolvedValueOnce([{ id: 'session-1' }, { id: 'session-2' }])
      .mockResolvedValueOnce([{ id: 'session-3' }])
      .mockResolvedValueOnce([]);
    prismaMock.userSession.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

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

  it('aborts the cleanup when ownership is lost between batches', async () => {
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
    } as unknown as CronJobExecutionContext;

    await expect(service.cleanupExpiredSessions(executionContext)).rejects.toThrow('LEASE_LOST');
    expect(prismaMock.userSession.deleteMany).toHaveBeenCalledTimes(1);
  });
});
