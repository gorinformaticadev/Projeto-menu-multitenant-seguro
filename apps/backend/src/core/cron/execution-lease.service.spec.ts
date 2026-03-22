import { PrismaService } from '../prisma/prisma.service';
import { ExecutionLeaseService } from './execution-lease.service';

describe('ExecutionLeaseService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  let service: ExecutionLeaseService;

  const buildLeaseRow = (overrides: Record<string, unknown> = {}) => {
    const baseTime = new Date('2026-03-22T12:00:00.000Z');
    return {
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-1',
      leaseVersion: 1n,
      status: 'active',
      startedAt: baseTime,
      heartbeatAt: baseTime,
      lockedUntil: new Date('2026-03-22T12:02:00.000Z'),
      acquiredAt: baseTime,
      releasedAt: null,
      releaseReason: null,
      lastError: null,
      createdAt: baseTime,
      updatedAt: baseTime,
      ...overrides,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExecutionLeaseService(prismaMock as unknown as PrismaService);
  });

  it('acquires a lease and returns the active fencing token', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      buildLeaseRow({
        cycleId: 'cycle-3',
        leaseVersion: 3n,
        lockedUntil: new Date('2026-03-22T12:05:00.000Z'),
      }),
    ]);

    const result = await service.acquireLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-3',
      startedAt: new Date('2026-03-22T12:03:00.000Z'),
      ttlMs: 120_000,
    });

    expect(result).toEqual({
      acquired: true,
      lease: expect.objectContaining({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-3',
        leaseVersion: 3n,
        status: 'active',
      }),
    });
  });

  it('returns the current lease owner when acquisition is denied', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildLeaseRow({
          ownerId: 'instance-b',
          cycleId: 'cycle-5',
          leaseVersion: 5n,
        }),
      ]);

    const result = await service.acquireLease({
      jobKey: 'system.session_cleanup',
      ownerId: 'instance-a',
      cycleId: 'cycle-6',
      startedAt: new Date('2026-03-22T12:06:00.000Z'),
      ttlMs: 120_000,
    });

    expect(result).toEqual({
      acquired: false,
      lease: expect.objectContaining({
        ownerId: 'instance-b',
        cycleId: 'cycle-5',
        leaseVersion: 5n,
      }),
    });
  });

  it('renews a lease only while the same owner, cycle and fencing token still hold it', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([buildLeaseRow()]);

    await expect(
      service.renewLease({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        leaseVersion: 1n,
        ttlMs: 120_000,
      }),
    ).resolves.toEqual({
      renewed: true,
      lease: expect.objectContaining({
        leaseVersion: 1n,
      }),
      reason: null,
    });
  });

  it('rejects zombie renew with fencing mismatch after takeover', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildLeaseRow({
          ownerId: 'instance-b',
          cycleId: 'cycle-2',
          leaseVersion: 2n,
        }),
      ]);

    await expect(
      service.renewLease({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        leaseVersion: 1n,
        ttlMs: 120_000,
      }),
    ).resolves.toEqual({
      renewed: false,
      lease: expect.objectContaining({
        ownerId: 'instance-b',
        cycleId: 'cycle-2',
        leaseVersion: 2n,
      }),
      reason: 'fencing_mismatch',
    });
  });

  it('rejects late release from a stale execution without touching the new owner', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildLeaseRow({
          ownerId: 'instance-b',
          cycleId: 'cycle-2',
          leaseVersion: 7n,
        }),
      ]);

    await expect(
      service.releaseLease({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        leaseVersion: 6n,
        reason: 'failed',
      }),
    ).resolves.toEqual({
      released: false,
      lease: expect.objectContaining({
        ownerId: 'instance-b',
        cycleId: 'cycle-2',
        leaseVersion: 7n,
      }),
      reason: 'fencing_mismatch',
    });
  });

  it('detects stale execution during explicit ownership checks', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildLeaseRow({
          ownerId: 'instance-b',
          cycleId: 'cycle-9',
          leaseVersion: 9n,
        }),
      ]);

    await expect(
      service.assertLeaseOwnership({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-a',
        cycleId: 'cycle-1',
        leaseVersion: 8n,
      }),
    ).resolves.toEqual({
      owned: false,
      lease: expect.objectContaining({
        ownerId: 'instance-b',
        cycleId: 'cycle-9',
        leaseVersion: 9n,
      }),
      reason: 'fencing_mismatch',
    });
  });
});
