import { Logger } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

type RedisHandler = (error?: Error) => void;

const redisInstances: MockRedis[] = [];

class MockRedis {
  status = 'wait';
  handlers: Record<string, RedisHandler> = {};
  connect = jest.fn(async () => {
    this.status = 'ready';
    this.handlers.ready?.();
  });
  eval = jest.fn(async () => [1, 1000, 0, 0]);

  on(event: string, handler: RedisHandler) {
    this.handlers[event] = handler;
    return this;
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const instance = new MockRedis();
    redisInstances.push(instance);
    return instance;
  }),
}));

describe('RedisThrottlerStorage', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    redisInstances.length = 0;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.useRealTimers();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

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

  it('suppresses repeated redis reconnect attempts while fallback cooldown is active', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T17:30:00.000Z'));

    const storage = new RedisThrottlerStorage({
      retryCooldownMs: 15000,
    });
    const redis = redisInstances[0];

    redis.connect.mockImplementation(async () => {
      redis.status = 'end';
      throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
    });

    await storage.increment('key-1', 1000, 10, 1000, 'default');
    await storage.increment('key-1', 1000, 10, 1000, 'default');

    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-03-14T17:30:16.000Z'));

    await storage.increment('key-1', 1000, 10, 1000, 'default');

    expect(redis.connect).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
