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
});
