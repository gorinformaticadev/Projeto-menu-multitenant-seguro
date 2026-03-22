import { PrismaService } from '../prisma/prisma.service';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';

describe('CronJobHeartbeatService', () => {
  const prismaMock = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };

  let service: CronJobHeartbeatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CronJobHeartbeatService(prismaMock as unknown as PrismaService);
  });

  it('marks a blocked cycle as skipped so the watchdog can see lastStartedAt', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);

    await expect(
      service.markSkipped(
        'system.session_cleanup',
        new Date('2026-03-22T15:08:00.000Z'),
        new Date('2026-03-22T15:08:00.050Z'),
        'DB_LEASE_DENIED',
        new Date('2026-03-22T15:15:00.000Z'),
        '1774192080000',
        'instance-a',
      ),
    ).resolves.toEqual({
      persisted: true,
      reason: null,
    });
  });

  it('does not overwrite a running heartbeat owned by another cycle when skip recording loses the race', async () => {
    prismaMock.$executeRaw.mockResolvedValue(0);

    await expect(
      service.markSkipped(
        'system.session_cleanup',
        new Date('2026-03-22T15:08:00.000Z'),
        new Date('2026-03-22T15:08:00.010Z'),
        'LOCK_DENIED',
        new Date('2026-03-22T15:15:00.000Z'),
        '1774192080000',
        'instance-b',
      ),
    ).resolves.toEqual({
      persisted: false,
      reason: 'stale_execution',
    });
  });
});
