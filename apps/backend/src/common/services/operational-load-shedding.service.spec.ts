import { DistributedOperationalStateService } from './distributed-operational-state.service';
import { OperationalLoadSheddingService } from './operational-load-shedding.service';

describe('OperationalLoadSheddingService', () => {
  const operationalObservabilityServiceMock = {
    record: jest.fn(),
  };
  const originalNodeAppInstance = process.env.NODE_APP_INSTANCE;
  const createdServices: OperationalLoadSheddingService[] = [];

  const createRuntimePressureServiceMock = (snapshotFactory: () => Record<string, unknown>) => ({
    getSnapshot: jest.fn(() => snapshotFactory()),
  });

  const createService = (
    instanceId: string,
    runtimePressureServiceMock: { getSnapshot: jest.Mock },
  ) => {
    process.env.NODE_APP_INSTANCE = instanceId;
    const service = new OperationalLoadSheddingService(
      runtimePressureServiceMock as any,
      new DistributedOperationalStateService(),
      operationalObservabilityServiceMock as any,
    );
    createdServices.push(service);
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    DistributedOperationalStateService.resetForTests();
  });

  afterEach(() => {
    createdServices.splice(0).forEach((service) => service.onModuleDestroy());
    process.env.NODE_APP_INSTANCE = originalNodeAppInstance;
    DistributedOperationalStateService.resetForTests();
  });

  it('aggregates the worst peer pressure across instances and activates mitigation', async () => {
    const runtimePressureA = createRuntimePressureServiceMock(() => ({
      eventLoopLagP95Ms: 200,
      eventLoopLagP99Ms: 330,
      eventLoopLagMaxMs: 440,
      eventLoopUtilization: 0.95,
      heapUsedRatio: 0.9,
      recentApiLatencyMs: 2_500,
      gcPauseP95Ms: 90,
      gcPauseMaxMs: 180,
      gcEventsRecent: 2,
      queueDepth: 4,
      activeIsolatedRequests: 1,
      pressureScore: 2.4,
      consecutiveBreaches: 2,
      adaptiveThrottleFactor: 0.45,
      cause: 'cpu',
      overloaded: true,
    }));
    const runtimePressureB = createRuntimePressureServiceMock(() => ({
      eventLoopLagP95Ms: 20,
      eventLoopLagP99Ms: 40,
      eventLoopLagMaxMs: 55,
      eventLoopUtilization: 0.18,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 180,
      gcPauseP95Ms: 0,
      gcPauseMaxMs: 0,
      gcEventsRecent: 0,
      queueDepth: 0,
      activeIsolatedRequests: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    }));

    const serviceA = createService('instance-a', runtimePressureA);
    const serviceB = createService('instance-b', runtimePressureB);

    await (serviceA as any).refreshSnapshot();
    await (serviceB as any).refreshSnapshot();

    expect(serviceB.getSnapshot()).toMatchObject({
      instanceCount: 2,
      overloadedInstances: 1,
      pressureCause: 'cpu',
      mitigation: expect.objectContaining({
        degradeHeavyFeatures: true,
        disableRemoteUpdateChecks: true,
      }),
    });
    expect(serviceB.getSnapshot().adaptiveThrottleFactor).toBeLessThan(1);
  });

  it('does not let a single overloaded peer collapse the whole cluster factor for light tenants', async () => {
    const runtimePressureA = createRuntimePressureServiceMock(() => ({
      eventLoopLagP95Ms: 220,
      eventLoopLagP99Ms: 360,
      eventLoopLagMaxMs: 500,
      eventLoopUtilization: 0.97,
      heapUsedRatio: 0.92,
      recentApiLatencyMs: 2_200,
      gcPauseP95Ms: 95,
      gcPauseMaxMs: 200,
      gcEventsRecent: 2,
      queueDepth: 3,
      activeIsolatedRequests: 1,
      pressureScore: 2.5,
      consecutiveBreaches: 2,
      adaptiveThrottleFactor: 0.45,
      cause: 'cpu',
      overloaded: true,
    }));
    const healthySnapshot = () => ({
      eventLoopLagP95Ms: 20,
      eventLoopLagP99Ms: 35,
      eventLoopLagMaxMs: 50,
      eventLoopUtilization: 0.18,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 140,
      gcPauseP95Ms: 0,
      gcPauseMaxMs: 0,
      gcEventsRecent: 0,
      queueDepth: 0,
      activeIsolatedRequests: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    });

    const serviceA = createService('instance-overloaded', runtimePressureA);
    const serviceB = createService('instance-healthy-b', createRuntimePressureServiceMock(healthySnapshot));
    const serviceC = createService('instance-healthy-c', createRuntimePressureServiceMock(healthySnapshot));
    const serviceD = createService('instance-healthy-d', createRuntimePressureServiceMock(healthySnapshot));

    await (serviceA as any).refreshSnapshot();
    await (serviceB as any).refreshSnapshot();
    await (serviceC as any).refreshSnapshot();
    await (serviceD as any).refreshSnapshot();

    expect(serviceB.getSnapshot()).toMatchObject({
      instanceCount: 4,
      overloadedInstances: 1,
    });
    expect(serviceB.getSnapshot().adaptiveThrottleFactor).toBeGreaterThanOrEqual(0.85);
    expect(serviceB.getSnapshot().adaptiveThrottleFactor).toBeLessThan(1);
    expect(serviceB.getSnapshot().mitigation.disableRemoteUpdateChecks).toBe(false);
  });

  it('isolates granular shedding by tenant and lets the signal decay over time', async () => {
    const runtimePressure = createRuntimePressureServiceMock(() => ({
      eventLoopLagP95Ms: 20,
      eventLoopLagP99Ms: 35,
      eventLoopLagMaxMs: 50,
      eventLoopUtilization: 0.18,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 120,
      gcPauseP95Ms: 0,
      gcPauseMaxMs: 0,
      gcEventsRecent: 0,
      queueDepth: 0,
      activeIsolatedRequests: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    }));
    const service = createService('instance-granular', runtimePressure);

    await service.recordGranularPressure({
      path: '/api/system/dashboard',
      tenantId: 'tenant-heavy',
      signal: 'queue_rejected',
      weight: 3,
    });

    await expect(
      service.resolveAdaptiveRateLimitContext('/api/system/dashboard', 'tenant-heavy'),
    ).resolves.toMatchObject({
      factor: 0.9,
      scope: 'tenant-route',
    });
    await expect(
      service.resolveAdaptiveRateLimitContext('/api/system/dashboard', 'tenant-light'),
    ).resolves.toMatchObject({
      factor: 1,
      scope: 'cluster',
    });

    const originalNow = Date.now;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(originalNow() + 45_000);

    await expect(
      service.resolveAdaptiveRateLimitContext('/api/system/dashboard', 'tenant-heavy'),
    ).resolves.toMatchObject({
      factor: 1,
      scope: 'cluster',
    });
    nowSpy.mockRestore();
  });

  it('uses hysteresis before restoring limits after stability returns', async () => {
    let currentSnapshot = {
      eventLoopLagP95Ms: 200,
      eventLoopLagP99Ms: 330,
      eventLoopLagMaxMs: 440,
      eventLoopUtilization: 0.95,
      heapUsedRatio: 0.9,
      recentApiLatencyMs: 2_100,
      gcPauseP95Ms: 90,
      gcPauseMaxMs: 180,
      gcEventsRecent: 2,
      queueDepth: 4,
      activeIsolatedRequests: 1,
      pressureScore: 2.4,
      consecutiveBreaches: 2,
      adaptiveThrottleFactor: 0.45,
      cause: 'cpu',
      overloaded: true,
    };
    const runtimePressure = createRuntimePressureServiceMock(() => currentSnapshot);
    const service = createService('instance-c', runtimePressure);

    await (service as any).refreshSnapshot();
    expect(service.getSnapshot().adaptiveThrottleFactor).toBe(0.45);

    currentSnapshot = {
      ...currentSnapshot,
      eventLoopLagP95Ms: 20,
      eventLoopLagP99Ms: 30,
      eventLoopLagMaxMs: 40,
      eventLoopUtilization: 0.2,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 120,
      queueDepth: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    };

    await (service as any).refreshSnapshot();
    await (service as any).refreshSnapshot();
    expect(service.getSnapshot().adaptiveThrottleFactor).toBe(0.45);

    await (service as any).refreshSnapshot();
    expect(service.getSnapshot().adaptiveThrottleFactor).toBeGreaterThan(0.45);
  });

  it('keeps redis fallback visible without degrading heavy features when there is no operational pressure', async () => {
    const runtimePressure = createRuntimePressureServiceMock(() => ({
      eventLoopLagP95Ms: 20,
      eventLoopLagP99Ms: 30,
      eventLoopLagMaxMs: 40,
      eventLoopUtilization: 0.18,
      heapUsedRatio: 0.4,
      recentApiLatencyMs: 120,
      gcPauseP95Ms: 0,
      gcPauseMaxMs: 0,
      gcEventsRecent: 0,
      queueDepth: 0,
      activeIsolatedRequests: 0,
      pressureScore: 0,
      consecutiveBreaches: 0,
      adaptiveThrottleFactor: 1,
      cause: 'normal',
      overloaded: false,
    }));
    const distributedState = new DistributedOperationalStateService();
    jest.spyOn(distributedState, 'isDistributedReady').mockReturnValue(false);

    process.env.NODE_APP_INSTANCE = 'instance-fallback';
    const service = new OperationalLoadSheddingService(
      runtimePressure as any,
      distributedState,
      operationalObservabilityServiceMock as any,
    );
    createdServices.push(service);

    await (service as any).refreshSnapshot();

    expect(service.getSnapshot()).toMatchObject({
      stateConsistency: 'local_fallback',
      mitigation: expect.objectContaining({
        degradeHeavyFeatures: false,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
      }),
    });
    expect(service.getSnapshot().mitigation.featureFlags).toEqual(
      expect.arrayContaining(['redis-fallback-visible']),
    );
  });
});
