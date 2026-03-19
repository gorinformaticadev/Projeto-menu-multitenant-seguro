import {
  evaluateRuntimePressureMeasurements,
  type RuntimePressureMeasurements,
  type RuntimePressureThresholds,
} from './runtime-pressure.service';

describe('evaluateRuntimePressureMeasurements', () => {
  const thresholds: RuntimePressureThresholds = {
    lagP99Ms: 250,
    lagP95Ms: 120,
    severeLagP99Ms: 450,
    eventLoopUtilization: 0.92,
    heapUsedRatio: 0.88,
    gcPauseP95Ms: 120,
    gcPauseMaxMs: 240,
    queueDepth: 3,
    apiLatencyMs: 1_200,
    ioLowUtilization: 0.7,
    minAdaptiveThrottleFactor: 0.35,
  };

  const baselineMeasurements: RuntimePressureMeasurements = {
    eventLoopLagP95Ms: 20,
    eventLoopLagP99Ms: 35,
    eventLoopLagMaxMs: 48,
    eventLoopUtilization: 0.25,
    heapUsedRatio: 0.42,
    recentApiLatencyMs: 120,
    gcPauseP95Ms: 0,
    gcPauseMaxMs: 0,
    gcEventsRecent: 0,
    queueDepth: 0,
    activeIsolatedRequests: 0,
  };

  it('classifies CPU pressure and reduces the adaptive throttle factor', () => {
    const evaluation = evaluateRuntimePressureMeasurements({
      measurements: {
        ...baselineMeasurements,
        eventLoopLagP99Ms: 320,
        eventLoopUtilization: 0.96,
      },
      thresholds,
      previousAdaptiveThrottleFactor: 1,
      recentBreaches: [true],
    });

    expect(evaluation).toMatchObject({
      breach: true,
      overloaded: true,
      cause: 'cpu',
      adaptiveThrottleFactor: 0.85,
    });
  });

  it('classifies GC pressure without mistaking it for CPU pressure', () => {
    const evaluation = evaluateRuntimePressureMeasurements({
      measurements: {
        ...baselineMeasurements,
        heapUsedRatio: 0.93,
        gcPauseP95Ms: 180,
        gcPauseMaxMs: 310,
      },
      thresholds,
      previousAdaptiveThrottleFactor: 1,
      recentBreaches: [],
    });

    expect(evaluation).toMatchObject({
      breach: true,
      severe: false,
      cause: 'gc',
    });
  });

  it('classifies severe IO pressure from queue growth and latency with low ELU', () => {
    const evaluation = evaluateRuntimePressureMeasurements({
      measurements: {
        ...baselineMeasurements,
        queueDepth: 6,
        recentApiLatencyMs: 1_800,
        eventLoopUtilization: 0.45,
      },
      thresholds,
      previousAdaptiveThrottleFactor: 0.9,
      recentBreaches: [true],
    });

    expect(evaluation).toMatchObject({
      breach: true,
      overloaded: true,
      cause: 'io',
      adaptiveThrottleFactor: 0.65,
    });
  });

  it('restores the adaptive factor gradually after stability returns', () => {
    const evaluation = evaluateRuntimePressureMeasurements({
      measurements: baselineMeasurements,
      thresholds,
      previousAdaptiveThrottleFactor: 0.55,
      recentBreaches: [true, false, false],
    });

    expect(evaluation).toMatchObject({
      breach: false,
      overloaded: false,
      cause: 'normal',
      adaptiveThrottleFactor: 0.6,
    });
  });
});
