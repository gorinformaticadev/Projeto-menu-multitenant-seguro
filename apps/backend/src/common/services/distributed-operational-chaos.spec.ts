import type { RouteRuntimeProtectionPolicy } from '@contracts/api-routes';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
import {
  CircuitBreakerOpenError,
  OperationalCircuitBreakerService,
} from './operational-circuit-breaker.service';
import { OperationalRequestQueueService } from './operational-request-queue.service';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 1_500,
  intervalMs = 10,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out while waiting for distributed chaos condition');
}

describe('distributed operational chaos', () => {
  const operationalObservabilityServiceMock = {
    record: jest.fn(),
  };
  const createdQueueServices: OperationalRequestQueueService[] = [];

  const runtimePolicy: RouteRuntimeProtectionPolicy = {
    shedOnCpuPressure: true,
    queueIsolationRequired: true,
    fairQueueScope: 'tenant',
    maxConcurrentRequests: 1,
    maxConcurrentPerPartition: 1,
    maxQueueDepth: 4,
    maxQueueDepthPerPartition: 2,
    maxQueueWaitMs: 2_000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    DistributedOperationalStateService.resetForTests();
  });

  afterEach(() => {
    createdQueueServices.splice(0).forEach((service) => service.onModuleDestroy());
    DistributedOperationalStateService.resetForTests();
  });

  it('contains simultaneous dependency failure and queue contention across instances', async () => {
    const queueServiceA = new OperationalRequestQueueService(
      operationalObservabilityServiceMock as any,
      new DistributedOperationalStateService(),
    );
    createdQueueServices.push(queueServiceA);
    const queueServiceB = new OperationalRequestQueueService(
      operationalObservabilityServiceMock as any,
      new DistributedOperationalStateService(),
    );
    createdQueueServices.push(queueServiceB);
    const breakerServiceA = new OperationalCircuitBreakerService(
      operationalObservabilityServiceMock as any,
      new DistributedOperationalStateService(),
    );
    const breakerServiceB = new OperationalCircuitBreakerService(
      operationalObservabilityServiceMock as any,
      new DistributedOperationalStateService(),
    );

    const breakerOptions = {
      key: 'dependency:redis',
      route: '/api/system/dashboard',
      failureThreshold: 1,
      resetTimeoutMs: 10_000,
      jitterRatio: 0,
    };

    await expect(
      breakerServiceA.execute(breakerOptions, async () => Promise.reject(new Error('redis down'))),
    ).rejects.toThrow('redis down');
    await expect(breakerServiceB.execute(breakerOptions, async () => 'ok')).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );

    const firstGate = createDeferred<void>();
    const firstStarted = createDeferred<void>();
    const executionOrder: string[] = [];

    const first = queueServiceA.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: runtimePolicy,
        request: {
          user: {
            id: 'user-a-1',
            tenantId: 'tenant-a',
          },
        },
      },
      async () => {
        executionOrder.push('tenant-a:first:start');
        firstStarted.resolve();
        await firstGate.promise;
        executionOrder.push('tenant-a:first:end');
        return 'tenant-a:first';
      },
    );

    const secondTenantA = queueServiceA.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: runtimePolicy,
        request: {
          user: {
            id: 'user-a-2',
            tenantId: 'tenant-a',
          },
        },
      },
      async () => {
        executionOrder.push('tenant-a:second:start');
        executionOrder.push('tenant-a:second:end');
        return 'tenant-a:second';
      },
    );

    const firstTenantB = queueServiceB.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: runtimePolicy,
        request: {
          user: {
            id: 'user-b-1',
            tenantId: 'tenant-b',
          },
        },
      },
      async () => {
        executionOrder.push('tenant-b:first:start');
        executionOrder.push('tenant-b:first:end');
        return 'tenant-b:first';
      },
    );

    await firstStarted.promise;
    await waitForCondition(
      () =>
        operationalObservabilityServiceMock.record.mock.calls.filter(
          ([event]) => event?.type === 'request_queued',
        ).length >= 2,
    );
    firstGate.resolve();

    await expect(first).resolves.toBe('tenant-a:first');
    await expect(firstTenantB).resolves.toBe('tenant-b:first');
    await expect(secondTenantA).resolves.toBe('tenant-a:second');
    expect(executionOrder).toEqual([
      'tenant-a:first:start',
      'tenant-a:first:end',
      'tenant-b:first:start',
      'tenant-b:first:end',
      'tenant-a:second:start',
      'tenant-a:second:end',
    ]);
  });
});
