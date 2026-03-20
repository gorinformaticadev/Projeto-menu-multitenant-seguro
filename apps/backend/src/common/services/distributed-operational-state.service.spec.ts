import type { RedisTopologyConfig } from './redis-topology.util';
import { DistributedOperationalStateService } from './distributed-operational-state.service';

function createRedisTopologyConfig(): RedisTopologyConfig {
  return {
    mode: 'standalone',
    enabled: true,
    valid: true,
    configured: true,
    required: false,
    fallbackMode: 'explicit',
    connectTimeoutMs: 1_500,
    retryCooldownMs: 15_000,
    invalidReason: null,
    standalone: {
      host: '127.0.0.1',
      port: 6379,
    },
  };
}

function createSlowRedisClient(delayMs: number) {
  const neverFastEnough = async <T>(value: T): Promise<T> =>
    new Promise((resolve) => {
      setTimeout(() => resolve(value), delayMs);
    });

  return {
    status: 'ready',
    on: jest.fn(),
    get: jest.fn(() => neverFastEnough(null)),
    mget: jest.fn(() => neverFastEnough([])),
    set: jest.fn(() => neverFastEnough('OK')),
    del: jest.fn(() => neverFastEnough(1)),
    sadd: jest.fn(() => neverFastEnough(1)),
    srem: jest.fn(() => neverFastEnough(1)),
    smembers: jest.fn(() => neverFastEnough([])),
    eval: jest.fn(() => neverFastEnough(1)),
    quit: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(),
  };
}

describe('DistributedOperationalStateService', () => {
  beforeEach(() => {
    DistributedOperationalStateService.resetForTests();
  });

  afterEach(() => {
    DistributedOperationalStateService.resetForTests();
  });

  it('enters explicit fallback when a redis read exceeds the operational timeout', async () => {
    const service = new DistributedOperationalStateService();
    (service as any).topologyConfig = createRedisTopologyConfig();
    (service as any).redisOperationTimeoutMs = 10;
    (service as any).redis = createSlowRedisClient(60);

    await expect(service.readJson('state:slow')).resolves.toBeNull();
    expect(service.isFallbackActive()).toBe(true);
    expect(service.getHealth()).toMatchObject({
      enabled: true,
      fallbackActive: true,
      detail: 'redis-timeout',
    });
    expect((service as any).lastFallbackDetail).toContain(
      'redis-operation-timeout:get:state:slow:10ms',
    );
  });

  it('falls back locally when the distributed lock path is too slow and still returns a result', async () => {
    const service = new DistributedOperationalStateService();
    (service as any).topologyConfig = createRedisTopologyConfig();
    (service as any).redisOperationTimeoutMs = 10;
    (service as any).redis = createSlowRedisClient(60);

    await expect(
      service.mutateJson(
        'state:mutate',
        {
          seed: { counter: 0 },
        },
        (state) => ({
          next: {
            counter: state.counter + 1,
          },
          result: state.counter + 1,
        }),
      ),
    ).resolves.toBe(1);

    expect(service.isFallbackActive()).toBe(true);
    expect(service.getHealth().detail).toBe('redis-timeout');
    expect((service as any).lastFallbackDetail).toContain(
      'redis-operation-timeout:lock-acquire:distributed-state:state:mutate:10ms',
    );
  });
});
