import {
  CircuitBreakerOpenError,
  OperationalCircuitBreakerService,
} from './operational-circuit-breaker.service';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

describe('OperationalCircuitBreakerService', () => {
  const operationalObservabilityServiceMock = {
    record: jest.fn(),
  };

  const createService = () =>
    new OperationalCircuitBreakerService(operationalObservabilityServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-19T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens after the failure threshold and rejects until the cooldown elapses', async () => {
    const service = createService();
    const options = {
      key: 'redis-metric',
      route: '/api/system/dashboard',
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
      jitterRatio: 0,
    };

    await expect(service.execute(options, async () => Promise.reject(new Error('boom-1')))).rejects.toThrow(
      'boom-1',
    );
    await expect(service.execute(options, async () => Promise.reject(new Error('boom-2')))).rejects.toThrow(
      'boom-2',
    );

    await expect(service.execute(options, async () => 'ok')).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
    expect(service.getSnapshot(options.key)).toMatchObject({
      mode: 'open',
      failures: 2,
      openCount: 1,
    });
  });

  it('limits half-open probes and only closes after the configured success threshold', async () => {
    const service = createService();
    const options = {
      key: 'database-metric',
      route: '/api/system/dashboard',
      failureThreshold: 1,
      resetTimeoutMs: 5_000,
      halfOpenMaxProbes: 2,
      halfOpenSuccessThreshold: 2,
      jitterRatio: 0,
    };

    await expect(service.execute(options, async () => Promise.reject(new Error('down')))).rejects.toThrow(
      'down',
    );

    jest.advanceTimersByTime(5_001);
    const secondGate = createDeferred<void>();

    const firstProbe = service.execute(options, async () => 'probe-1');
    const secondProbe = service.execute(options, async () => {
      await secondGate.promise;
      return 'probe-2';
    });
    await expect(service.execute(options, async () => 'probe-3')).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );

    await expect(firstProbe).resolves.toBe('probe-1');
    expect(service.getSnapshot(options.key)).toMatchObject({
      mode: 'half-open',
      halfOpenSuccesses: 1,
      halfOpenProbeAttempts: 2,
    });

    secondGate.resolve();
    await expect(secondProbe).resolves.toBe('probe-2');
    expect(service.getSnapshot(options.key)).toMatchObject({
      mode: 'closed',
      failures: 0,
      halfOpenSuccesses: 0,
    });
  });

  it('reopens from half-open with jittered cooldown and gradual recovery memory', async () => {
    const service = createService();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(1);
    const options = {
      key: 'remote-update',
      route: '/api/update/check',
      failureThreshold: 1,
      resetTimeoutMs: 4_000,
      halfOpenMaxProbes: 1,
      halfOpenSuccessThreshold: 1,
      jitterRatio: 0.2,
    };

    await expect(service.execute(options, async () => Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline',
    );
    const firstOpenedUntil = service.getSnapshot(options.key).openedUntil;
    expect(firstOpenedUntil).toBe(Date.now() + 4_800);

    jest.advanceTimersByTime(4_801);

    await expect(
      service.execute(options, async () => Promise.reject(new Error('still-offline'))),
    ).rejects.toThrow('still-offline');

    const reopenedSnapshot = service.getSnapshot(options.key);
    expect(reopenedSnapshot).toMatchObject({
      mode: 'open',
      openCount: 2,
      failures: 2,
    });
    expect(reopenedSnapshot.openedUntil).toBe(Date.now() + 6_000);

    jest.advanceTimersByTime(6_001);
    await expect(service.execute(options, async () => 'recovered')).resolves.toBe('recovered');
    expect(service.getSnapshot(options.key)).toMatchObject({
      mode: 'closed',
      openCount: 1,
      failures: 0,
    });

    randomSpy.mockRestore();
  });
});
