import { PrismaService } from '../prisma/prisma.service';
import { ExecutionLeaseService } from './execution-lease.service';

describe('ExecutionLeaseService', () => {
  const prismaMock = {
    executionLease: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  let service: ExecutionLeaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExecutionLeaseService(prismaMock as unknown as PrismaService);
  });

  it('acquires a lease when the upsert returns the active row', async () => {
    const startedAt = new Date('2026-03-22T12:00:00.000Z');
    const lockedUntil = new Date('2026-03-22T12:02:00.000Z');
    prismaMock.$queryRaw.mockResolvedValue([
      {
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        status: 'active',
        startedAt,
        heartbeatAt: startedAt,
        lockedUntil,
        acquiredAt: startedAt,
        releasedAt: null,
        releaseReason: null,
        lastError: null,
        createdAt: startedAt,
        updatedAt: startedAt,
      },
    ]);

    const result = await service.acquireLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-1',
      startedAt,
      ttlMs: 120_000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        acquired: true,
        lease: expect.objectContaining({
          jobKey: 'system.session_cleanup',
          ownerId: 'instance-a',
          cycleId: 'cycle-1',
          status: 'active',
          lockedUntil,
        }),
      }),
    );
  });

  it('returns the current lease owner when acquisition is denied', async () => {
    const activeLease = {
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-b',
      cycleId: 'cycle-2',
      status: 'active',
      startedAt: new Date('2026-03-22T12:00:00.000Z'),
      heartbeatAt: new Date('2026-03-22T12:00:30.000Z'),
      lockedUntil: new Date('2026-03-22T12:02:30.000Z'),
      acquiredAt: new Date('2026-03-22T12:00:00.000Z'),
      releasedAt: null,
      releaseReason: null,
      lastError: null,
      createdAt: new Date('2026-03-22T12:00:00.000Z'),
      updatedAt: new Date('2026-03-22T12:00:30.000Z'),
    };
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([activeLease]);

    const result = await service.acquireLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-3',
      startedAt: new Date('2026-03-22T12:01:00.000Z'),
      ttlMs: 120_000,
    });

    expect(result).toEqual({
      acquired: false,
      lease: expect.objectContaining({
        ownerId: 'instance-b',
        cycleId: 'cycle-2',
        status: 'active',
      }),
    });
  });

  it('renews a lease only while the same owner and cycle still hold it', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        jobKey: 'system.session_cleanup',
      },
    ]);

    const renewed = await service.renewLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-1',
      heartbeatAt: new Date('2026-03-22T12:00:30.000Z'),
      ttlMs: 120_000,
    });

    expect(renewed).toBe(true);
  });

  it('releases a lease only for the owning cycle', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        jobKey: 'system.session_cleanup',
      },
    ]);

    const released = await service.releaseLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-1',
      releasedAt: new Date('2026-03-22T12:01:00.000Z'),
      reason: 'completed',
    });

    expect(released).toBe(true);
  });

  it('returns false when renew or release do not match the active owner anymore', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(
      service.renewLease({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        ttlMs: 120_000,
      }),
    ).resolves.toBe(false);

    await expect(
      service.releaseLease({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        reason: 'failed',
      }),
    ).resolves.toBe(false);
  });
});
