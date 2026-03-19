import { HttpException } from '@nestjs/common';
import type { RouteRuntimeProtectionPolicy } from '@contracts/api-routes';
import { OperationalRequestQueueService } from './operational-request-queue.service';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe('OperationalRequestQueueService', () => {
  const operationalObservabilityServiceMock = {
    record: jest.fn(),
  };

  const runtimePolicy: RouteRuntimeProtectionPolicy = {
    shedOnCpuPressure: true,
    queueIsolationRequired: true,
    fairQueueScope: 'tenant',
    maxConcurrentRequests: 1,
    maxConcurrentPerPartition: 1,
    maxQueueDepth: 1,
    maxQueueDepthPerPartition: 1,
    maxQueueWaitMs: 2_000,
  };

  const createService = () =>
    new OperationalRequestQueueService(operationalObservabilityServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('serializes heavy requests behind a single execution slot', async () => {
    const service = createService();
    const firstGate = createDeferred<void>();
    const executionOrder: string[] = [];

    const first = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/system/update/run',
        runtime: runtimePolicy,
      },
      async () => {
        executionOrder.push('first:start');
        await firstGate.promise;
        executionOrder.push('first:end');
        return 'first';
      },
    );

    const second = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/system/update/run',
        runtime: runtimePolicy,
      },
      async () => {
        executionOrder.push('second:start');
        executionOrder.push('second:end');
        return 'second';
      },
    );

    await Promise.resolve();
    expect(executionOrder).toEqual(['first:start']);

    firstGate.resolve();

    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(executionOrder).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
    expect(operationalObservabilityServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request_queued',
        route: '/api/system/update/run',
      }),
    );
  });

  it('rejects immediately when the protected queue is already full', async () => {
    const service = createService();
    const firstGate = createDeferred<void>();

    const first = service.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/configuracoes/sistema/modulos/upload',
        runtime: runtimePolicy,
      },
      async () => {
        await firstGate.promise;
        return 'first';
      },
    );

    const second = service.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/configuracoes/sistema/modulos/upload',
        runtime: runtimePolicy,
      },
      async () => 'second',
    );

    await Promise.resolve();

    await expect(
      service.run(
        {
          routePolicyId: 'cron-system-settings',
          route: '/api/configuracoes/sistema/modulos/upload',
          runtime: runtimePolicy,
        },
        async () => 'third',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        code: 'REQUEST_QUEUE_FULL',
      }),
    });

    firstGate.resolve();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
  });

  it('times out queued requests that wait beyond the route budget', async () => {
    jest.useFakeTimers();
    const service = createService();
    const firstGate = createDeferred<void>();

    const first = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/backup/create',
        runtime: runtimePolicy,
      },
      async () => {
        await firstGate.promise;
        return 'first';
      },
    );

    const queued = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/backup/create',
        runtime: runtimePolicy,
      },
      async () => 'second',
    );
    const queuedResult = queued.catch((error) => error);

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(runtimePolicy.maxQueueWaitMs + 10);

    await expect(queuedResult).resolves.toBeInstanceOf(HttpException);
    await expect(queuedResult).resolves.toMatchObject({
      response: expect.objectContaining({
        statusCode: 503,
        code: 'REQUEST_QUEUE_TIMEOUT',
      }),
    });

    firstGate.resolve();
    await expect(first).resolves.toBe('first');
  });

  it('alternates partitions fairly so one tenant does not starve another', async () => {
    const service = createService();
    const firstGate = createDeferred<void>();
    const executionOrder: string[] = [];
    const fairRuntimePolicy: RouteRuntimeProtectionPolicy = {
      ...runtimePolicy,
      maxQueueDepth: 4,
      maxQueueDepthPerPartition: 2,
    };

    const first = service.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: fairRuntimePolicy,
        request: {
          user: {
            id: 'user-a-1',
            tenantId: 'tenant-a',
          },
        },
      },
      async () => {
        executionOrder.push('tenant-a:first:start');
        await firstGate.promise;
        executionOrder.push('tenant-a:first:end');
        return 'tenant-a:first';
      },
    );

    const secondTenantA = service.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: fairRuntimePolicy,
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

    const firstTenantB = service.run(
      {
        routePolicyId: 'cron-system-settings',
        route: '/api/cron/run',
        runtime: fairRuntimePolicy,
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

    await Promise.resolve();
    expect(executionOrder).toEqual(['tenant-a:first:start']);

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

  it('enforces per-partition queue quotas so one tenant cannot monopolize the queue', async () => {
    const service = createService();
    const firstGate = createDeferred<void>();
    const quotaRuntimePolicy: RouteRuntimeProtectionPolicy = {
      ...runtimePolicy,
      maxQueueDepth: 4,
      maxQueueDepthPerPartition: 1,
    };

    const first = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/update/execute',
        runtime: quotaRuntimePolicy,
        request: {
          user: {
            id: 'user-a-1',
            tenantId: 'tenant-a',
          },
        },
      },
      async () => {
        await firstGate.promise;
        return 'first';
      },
    );

    const second = service.run(
      {
        routePolicyId: 'backup-update-audit',
        route: '/api/update/execute',
        runtime: quotaRuntimePolicy,
        request: {
          user: {
            id: 'user-a-2',
            tenantId: 'tenant-a',
          },
        },
      },
      async () => 'second',
    );

    await Promise.resolve();

    await expect(
      service.run(
        {
          routePolicyId: 'backup-update-audit',
          route: '/api/update/execute',
          runtime: quotaRuntimePolicy,
          request: {
            user: {
              id: 'user-a-3',
              tenantId: 'tenant-a',
            },
          },
        },
        async () => 'third',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        code: 'REQUEST_QUEUE_FULL',
        partitionKey: 'tenant:tenant-a',
      }),
    });

    firstGate.resolve();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
  });
});
