import { RedisLockService } from './redis-lock.service';

describe('RedisLockService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      REDIS_ENABLED: 'true',
      REDIS_MODE: 'sentinel',
      REDIS_SENTINELS: '',
      REDIS_MASTER_NAME: 'mymaster',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns an explicit degraded lock state when redis topology is invalid', async () => {
    const service = new RedisLockService();
    await service.onModuleInit();

    await expect(service.acquireLockState('lock:test', 1000, 'instance-a')).resolves.toBe(
      'degraded',
    );
    await expect(service.getHealth()).resolves.toMatchObject({
      enabled: true,
      valid: false,
      fallbackActive: true,
      detail: 'redis-sentinels-missing',
    });
  });
});
