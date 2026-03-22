import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaterializedCronExecutionService } from './materialized-cron-execution.service';

describe('MaterializedCronExecutionService', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  let service: MaterializedCronExecutionService;

  const buildRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'execution-1',
    jobKey: 'system.session_cleanup',
    scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
    triggeredAt: new Date('2026-03-22T15:00:02.000Z'),
    startedAt: null,
    finishedAt: null,
    status: 'pending',
    ownerId: null,
    attempt: 0,
    leaseVersion: 0n,
    lockedUntil: null,
    heartbeatAt: null,
    reason: null,
    error: null,
    metadata: {} as Prisma.JsonValue,
    createdAt: new Date('2026-03-22T15:00:02.000Z'),
    updatedAt: new Date('2026-03-22T15:00:02.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterializedCronExecutionService(prismaMock as unknown as PrismaService);
  });

  it('reuses the existing execution when the same slot was already materialized', async () => {
    const existing = {
      id: 'execution-existing',
      jobKey: 'system.session_cleanup',
      scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
      triggeredAt: new Date('2026-03-22T15:00:02.000Z'),
      startedAt: null,
      finishedAt: null,
      status: 'pending' as const,
      ownerId: null,
      attempt: 0,
      leaseVersion: 0n,
      lockedUntil: null,
      heartbeatAt: null,
      reason: null,
      error: null,
      metadata: {},
      createdAt: new Date('2026-03-22T15:00:02.000Z'),
      updatedAt: new Date('2026-03-22T15:00:02.000Z'),
    };

    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    jest.spyOn(service, 'getBySlot').mockResolvedValue(existing);

    await expect(
      service.materializeExecution({
        jobKey: 'system.session_cleanup',
        scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
      }),
    ).resolves.toEqual({
      created: false,
      execution: existing,
    });
  });

  it('maps a takeover claim with incremented attempt and fencing token', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      buildRow({
        status: 'running',
        ownerId: 'instance-b',
        attempt: 2,
        leaseVersion: 3n,
        startedAt: new Date('2026-03-22T15:05:00.000Z'),
        lockedUntil: new Date('2026-03-22T15:07:00.000Z'),
        heartbeatAt: new Date('2026-03-22T15:05:00.000Z'),
        reason: 'takeover_after_expiration',
      }),
    ]);

    await expect(
      service.claimNextRunnableExecution({
        jobKey: 'system.session_cleanup',
        ownerId: 'instance-b',
        ttlMs: 120000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'running',
        ownerId: 'instance-b',
        attempt: 2,
        leaseVersion: 3n,
        reason: 'takeover_after_expiration',
      }),
    );
  });

  it('rejects stale finalization when the execution was taken over with a newer fencing token', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    jest.spyOn(service, 'getById').mockResolvedValue({
      id: 'execution-1',
      jobKey: 'system.session_cleanup',
      scheduledFor: new Date('2026-03-22T15:00:00.000Z'),
      triggeredAt: new Date('2026-03-22T15:00:02.000Z'),
      startedAt: new Date('2026-03-22T15:00:10.000Z'),
      finishedAt: null,
      status: 'running',
      ownerId: 'instance-a',
      attempt: 2,
      leaseVersion: 4n,
      lockedUntil: new Date('2026-03-22T15:02:10.000Z'),
      heartbeatAt: new Date('2026-03-22T15:01:10.000Z'),
      reason: null,
      error: null,
      metadata: {},
      createdAt: new Date('2026-03-22T15:00:02.000Z'),
      updatedAt: new Date('2026-03-22T15:01:10.000Z'),
    });

    await expect(
      service.finalizeExecution({
        executionId: 'execution-1',
        ownerId: 'instance-a',
        leaseVersion: 3n,
        status: 'success',
        reason: 'completed',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        persisted: false,
        reason: 'fencing_mismatch',
      }),
    );
  });
});
