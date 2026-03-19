import { CronJobHeartbeatService } from './cron-job-heartbeat.service';

describe('CronJobHeartbeatService', () => {
  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  const createService = () =>
    new CronJobHeartbeatService(prismaMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads heartbeat rows in compatibility mode when optional columns are missing', async () => {
    const service = createService();
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          jobKey: 'job-a',
          lastStartedAt: null,
          lastHeartbeatAt: null,
          lastSucceededAt: null,
          lastFailedAt: null,
          lastDurationMs: null,
          lastStatus: 'idle',
          lastError: null,
          nextExpectedRunAt: null,
          consecutiveFailureCount: 0,
          updatedAt: new Date('2026-03-19T12:00:00.000Z'),
          cycleId: null,
          instanceId: null,
        },
      ]);

    const result = await service.get('job-a');

    expect(result).toMatchObject({
      jobKey: 'job-a',
      lastHeartbeatAt: null,
      cycleId: null,
      instanceId: null,
      lastStatus: 'idle',
    });
    expect(String(prismaMock.$queryRawUnsafe.mock.calls[1][0])).toContain(
      'NULL::TIMESTAMP AS "lastHeartbeatAt"',
    );
  });

  it('uses updatedAt as the stale-running fallback when lastHeartbeatAt is not available', async () => {
    const service = createService();
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
    prismaMock.$executeRawUnsafe.mockResolvedValueOnce(1);

    const result = await service.markStarted(
      'job-a',
      new Date('2026-03-19T12:00:00.000Z'),
      new Date('2026-03-19T12:05:00.000Z'),
      'cycle-a',
      'instance-a',
    );

    expect(result).toBe(true);
    expect(String(prismaMock.$executeRawUnsafe.mock.calls[0][0])).toContain('"updatedAt" <');
    expect(String(prismaMock.$executeRawUnsafe.mock.calls[0][0])).not.toContain(
      '"lastHeartbeatAt" <',
    );
  });
});
