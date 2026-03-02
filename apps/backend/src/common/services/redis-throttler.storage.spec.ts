import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('falls back to local memory storage when redis is disabled', async () => {
    const storage = new RedisThrottlerStorage({ enabled: false });
    const key = 'test-key';

    const first = await storage.increment(key, 1000, 2, 1000, 'default');
    const second = await storage.increment(key, 1000, 2, 1000, 'default');
    const third = await storage.increment(key, 1000, 2, 1000, 'default');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(third.totalHits).toBeGreaterThan(2);
    expect(third.isBlocked).toBe(true);
    expect(third.timeToBlockExpire).toBeGreaterThan(0);
  });
});
