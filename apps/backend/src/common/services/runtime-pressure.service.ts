import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { PerformanceObserver, monitorEventLoopDelay, performance } from 'perf_hooks';
import { OperationalRequestQueueService } from './operational-request-queue.service';
import { SystemTelemetryService } from './system-telemetry.service';

export type RuntimePressureCause = 'normal' | 'cpu' | 'gc' | 'io' | 'mixed';

export type RuntimePressureSnapshot = {
  eventLoopLagP95Ms: number;
  eventLoopLagP99Ms: number;
  eventLoopLagMaxMs: number;
  eventLoopUtilization: number;
  heapUsedRatio: number;
  recentApiLatencyMs: number | null;
  gcPauseP95Ms: number;
  gcPauseMaxMs: number;
  gcEventsRecent: number;
  queueDepth: number;
  activeIsolatedRequests: number;
  pressureScore: number;
  consecutiveBreaches: number;
  adaptiveThrottleFactor: number;
  cause: RuntimePressureCause;
  overloaded: boolean;
};

export type RuntimePressureMeasurements = {
  eventLoopLagP95Ms: number;
  eventLoopLagP99Ms: number;
  eventLoopLagMaxMs: number;
  eventLoopUtilization: number;
  heapUsedRatio: number;
  recentApiLatencyMs: number | null;
  gcPauseP95Ms: number;
  gcPauseMaxMs: number;
  gcEventsRecent: number;
  queueDepth: number;
  activeIsolatedRequests: number;
};

export type RuntimePressureThresholds = {
  lagP99Ms: number;
  lagP95Ms: number;
  severeLagP99Ms: number;
  eventLoopUtilization: number;
  heapUsedRatio: number;
  gcPauseP95Ms: number;
  gcPauseMaxMs: number;
  queueDepth: number;
  apiLatencyMs: number;
  ioLowUtilization: number;
  minAdaptiveThrottleFactor: number;
};

const DEFAULT_EVENT_LOOP_LAG_P99_THRESHOLD_MS = 250;
const DEFAULT_EVENT_LOOP_LAG_P95_THRESHOLD_MS = 120;
const DEFAULT_EVENT_LOOP_UTILIZATION_THRESHOLD = 0.92;
const DEFAULT_HEAP_USED_RATIO_THRESHOLD = 0.88;
const DEFAULT_GC_PAUSE_P95_THRESHOLD_MS = 120;
const DEFAULT_QUEUE_DEPTH_THRESHOLD = 3;
const DEFAULT_API_LATENCY_THRESHOLD_MS = 1_200;
const DEFAULT_IO_LOW_UTILIZATION_THRESHOLD = 0.7;
const DEFAULT_MIN_ADAPTIVE_THROTTLE_FACTOR = 0.35;
const SAMPLE_WINDOW_MS = 60_000;
const SAMPLE_INTERVAL_MS = 1_000;
const API_LATENCY_WINDOW_MS = 60_000;

type RuntimePressureSample = RuntimePressureMeasurements & {
  at: number;
  breach: boolean;
  severe: boolean;
  cause: RuntimePressureCause;
  pressureScore: number;
};

type RuntimePressureEvaluation = {
  breach: boolean;
  severe: boolean;
  cause: RuntimePressureCause;
  pressureScore: number;
  overloaded: boolean;
  consecutiveBreaches: number;
  adaptiveThrottleFactor: number;
};

export function evaluateRuntimePressureMeasurements(input: {
  measurements: RuntimePressureMeasurements;
  thresholds: RuntimePressureThresholds;
  previousAdaptiveThrottleFactor: number;
  recentBreaches: boolean[];
}): RuntimePressureEvaluation {
  const { measurements, thresholds } = input;
  const cpuSignal =
    measurements.eventLoopLagP99Ms >= thresholds.lagP99Ms &&
    measurements.eventLoopUtilization >= thresholds.eventLoopUtilization;
  const gcSignal =
    measurements.heapUsedRatio >= thresholds.heapUsedRatio &&
    (measurements.gcPauseP95Ms >= thresholds.gcPauseP95Ms ||
      measurements.gcPauseMaxMs >= thresholds.gcPauseMaxMs ||
      measurements.eventLoopLagP95Ms >= thresholds.lagP95Ms);
  const ioSignal =
    measurements.queueDepth >= thresholds.queueDepth &&
    measurements.eventLoopUtilization <= thresholds.ioLowUtilization &&
    (measurements.recentApiLatencyMs || 0) >= thresholds.apiLatencyMs;

  const severe =
    measurements.eventLoopLagP99Ms >= thresholds.severeLagP99Ms ||
    measurements.gcPauseMaxMs >= thresholds.gcPauseMaxMs * 1.5 ||
    measurements.queueDepth >= thresholds.queueDepth * 2;

  let pressureScore = 0;
  if (cpuSignal) {
    pressureScore += 1.2;
  }
  if (gcSignal) {
    pressureScore += 1;
  }
  if (ioSignal) {
    pressureScore += 0.9;
  }
  if (severe) {
    pressureScore += 1.1;
  }
  pressureScore = Number(pressureScore.toFixed(2));

  const breach = severe || pressureScore >= 1;
  const nextRecentBreaches = [...input.recentBreaches.slice(-2), breach];
  const breachesInRecentWindow = nextRecentBreaches.filter(Boolean).length;
  const overloaded = severe || breachesInRecentWindow >= 2;
  let consecutiveBreaches = 0;
  if (breach) {
    consecutiveBreaches = 1;
    for (let index = input.recentBreaches.length - 1; index >= 0; index -= 1) {
      if (!input.recentBreaches[index]) {
        break;
      }
      consecutiveBreaches += 1;
    }
  }

  let cause: RuntimePressureCause = 'normal';
  const causes = [
    cpuSignal ? 'cpu' : null,
    gcSignal ? 'gc' : null,
    ioSignal ? 'io' : null,
  ].filter(Boolean) as Array<'cpu' | 'gc' | 'io'>;
  if (causes.length === 1) {
    cause = causes[0];
  } else if (causes.length > 1) {
    cause = 'mixed';
  }

  const minFactor = thresholds.minAdaptiveThrottleFactor;
  const previousFactor = Number.isFinite(input.previousAdaptiveThrottleFactor)
    ? input.previousAdaptiveThrottleFactor
    : 1;
  let adaptiveThrottleFactor = previousFactor;
  if (severe) {
    adaptiveThrottleFactor = Math.max(minFactor, previousFactor - 0.25);
  } else if (overloaded) {
    adaptiveThrottleFactor = Math.max(minFactor, previousFactor - 0.15);
  } else if (breach) {
    adaptiveThrottleFactor = Math.max(minFactor, previousFactor - 0.05);
  } else {
    adaptiveThrottleFactor = Math.min(1, previousFactor + 0.05);
  }

  return {
    breach,
    severe,
    cause,
    pressureScore,
    overloaded,
    consecutiveBreaches,
    adaptiveThrottleFactor: Number(adaptiveThrottleFactor.toFixed(2)),
  };
}

@Injectable()
export class RuntimePressureService implements OnModuleDestroy {
  private readonly logger = new Logger(RuntimePressureService.name);
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private readonly gcPauses: Array<{ at: number; durationMs: number }> = [];
  private readonly samples: RuntimePressureSample[] = [];
  private readonly samplingTimer: NodeJS.Timeout;
  private readonly gcObserver: PerformanceObserver | null;
  private lastUtilization = performance.eventLoopUtilization();
  private adaptiveThrottleFactor = 1;
  private latestSnapshot: RuntimePressureSnapshot;

  constructor(
    private readonly systemTelemetryService: SystemTelemetryService,
    @Optional()
    private readonly operationalRequestQueueService?: OperationalRequestQueueService,
  ) {
    this.latestSnapshot = this.buildEmptySnapshot();
    this.eventLoopDelay.enable();
    this.gcObserver = this.createGcObserver();
    this.sampleNow();
    this.samplingTimer = setInterval(() => this.sampleNow(), SAMPLE_INTERVAL_MS);
    this.samplingTimer.unref?.();
    this.logger.log('Monitor de pressao de runtime inicializado.');
  }

  onModuleDestroy(): void {
    clearInterval(this.samplingTimer);
    this.eventLoopDelay.disable();
    this.gcObserver?.disconnect();
  }

  getSnapshot(): RuntimePressureSnapshot {
    return { ...this.latestSnapshot };
  }

  shouldShedRequests(): boolean {
    return this.latestSnapshot.overloaded;
  }

  getAdaptiveThrottleFactor(): number {
    return this.latestSnapshot.adaptiveThrottleFactor;
  }

  private sampleNow(): void {
    const measurements = this.collectMeasurements();
    const thresholds = this.getThresholds();
    const recentBreaches = this.samples.slice(-3).map((sample) => sample.breach);
    const evaluation = evaluateRuntimePressureMeasurements({
      measurements,
      thresholds,
      previousAdaptiveThrottleFactor: this.adaptiveThrottleFactor,
      recentBreaches,
    });

    const sample: RuntimePressureSample = {
      ...measurements,
      at: Date.now(),
      breach: evaluation.breach,
      severe: evaluation.severe,
      cause: evaluation.cause,
      pressureScore: evaluation.pressureScore,
    };

    this.adaptiveThrottleFactor = evaluation.adaptiveThrottleFactor;
    this.samples.push(sample);
    this.pruneSamples();

    this.latestSnapshot = {
      ...measurements,
      pressureScore: evaluation.pressureScore,
      consecutiveBreaches: this.countConsecutiveBreaches(),
      adaptiveThrottleFactor: evaluation.adaptiveThrottleFactor,
      cause: evaluation.cause,
      overloaded: evaluation.overloaded,
    };
  }

  private collectMeasurements(): RuntimePressureMeasurements {
    const utilization = performance.eventLoopUtilization(this.lastUtilization);
    this.lastUtilization = performance.eventLoopUtilization();

    const eventLoopLagP95Ms = this.nsToMs(this.eventLoopDelay.percentile(95));
    const eventLoopLagP99Ms = this.nsToMs(this.eventLoopDelay.percentile(99));
    const eventLoopLagMaxMs = this.nsToMs(this.eventLoopDelay.max);
    const eventLoopUtilization = this.normalizeUtilization(utilization.utilization);

    const memoryUsage = process.memoryUsage();
    const heapUsedRatio =
      memoryUsage.heapTotal > 0
        ? Number((memoryUsage.heapUsed / memoryUsage.heapTotal).toFixed(4))
        : 0;

    const apiSnapshot = this.systemTelemetryService.getApiSnapshot(API_LATENCY_WINDOW_MS);
    const queueSnapshot = this.operationalRequestQueueService?.getSnapshot() || {
      totalActive: 0,
      totalQueued: 0,
      routes: [],
    };

    const gcWindow = this.pruneGcPauses();
    const gcPauseP95Ms = this.calculatePercentile(gcWindow, 0.95);
    const gcPauseMaxMs = gcWindow.length > 0 ? Math.max(...gcWindow) : 0;

    this.eventLoopDelay.reset();

    return {
      eventLoopLagP95Ms,
      eventLoopLagP99Ms,
      eventLoopLagMaxMs,
      eventLoopUtilization,
      heapUsedRatio,
      recentApiLatencyMs: apiSnapshot.avgResponseMs,
      gcPauseP95Ms,
      gcPauseMaxMs,
      gcEventsRecent: gcWindow.length,
      queueDepth: queueSnapshot.totalQueued,
      activeIsolatedRequests: queueSnapshot.totalActive,
    };
  }

  private pruneSamples(now = Date.now()) {
    const cutoff = now - SAMPLE_WINDOW_MS;
    while (this.samples.length > 0 && this.samples[0].at < cutoff) {
      this.samples.shift();
    }
  }

  private pruneGcPauses(now = Date.now()): number[] {
    const cutoff = now - SAMPLE_WINDOW_MS;
    while (this.gcPauses.length > 0 && this.gcPauses[0].at < cutoff) {
      this.gcPauses.shift();
    }
    return this.gcPauses.map((entry) => entry.durationMs);
  }

  private countConsecutiveBreaches(): number {
    let count = 0;
    for (let index = this.samples.length - 1; index >= 0; index -= 1) {
      if (!this.samples[index].breach) {
        break;
      }
      count += 1;
    }
    return count;
  }

  private createGcObserver(): PerformanceObserver | null {
    try {
      const observer = new PerformanceObserver((list) => {
        const now = Date.now();
        for (const entry of list.getEntries()) {
          this.gcPauses.push({
            at: now,
            durationMs: Number(entry.duration.toFixed(2)),
          });
        }
        this.pruneGcPauses(now);
      });
      observer.observe({ entryTypes: ['gc'] });
      return observer;
    } catch {
      return null;
    }
  }

  private buildEmptySnapshot(): RuntimePressureSnapshot {
    return {
      eventLoopLagP95Ms: 0,
      eventLoopLagP99Ms: 0,
      eventLoopLagMaxMs: 0,
      eventLoopUtilization: 0,
      heapUsedRatio: 0,
      recentApiLatencyMs: null,
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
    };
  }

  private getThresholds(): RuntimePressureThresholds {
    const lagP99Ms = this.readNumberFromEnv(
      'RUNTIME_PRESSURE_EVENT_LOOP_LAG_P99_MS',
      DEFAULT_EVENT_LOOP_LAG_P99_THRESHOLD_MS,
      10,
      5_000,
    );

    return {
      lagP99Ms,
      lagP95Ms: this.readNumberFromEnv(
        'RUNTIME_PRESSURE_EVENT_LOOP_LAG_P95_MS',
        DEFAULT_EVENT_LOOP_LAG_P95_THRESHOLD_MS,
        5,
        lagP99Ms,
      ),
      severeLagP99Ms: Number((lagP99Ms * 1.8).toFixed(2)),
      eventLoopUtilization: this.readRatioFromEnv(
        'RUNTIME_PRESSURE_EVENT_LOOP_UTILIZATION',
        DEFAULT_EVENT_LOOP_UTILIZATION_THRESHOLD,
      ),
      heapUsedRatio: this.readRatioFromEnv(
        'RUNTIME_PRESSURE_HEAP_USED_RATIO',
        DEFAULT_HEAP_USED_RATIO_THRESHOLD,
      ),
      gcPauseP95Ms: this.readNumberFromEnv(
        'RUNTIME_PRESSURE_GC_PAUSE_P95_MS',
        DEFAULT_GC_PAUSE_P95_THRESHOLD_MS,
        10,
        5_000,
      ),
      gcPauseMaxMs: this.readNumberFromEnv(
        'RUNTIME_PRESSURE_GC_PAUSE_MAX_MS',
        DEFAULT_GC_PAUSE_P95_THRESHOLD_MS * 2,
        10,
        10_000,
      ),
      queueDepth: this.readNumberFromEnv(
        'RUNTIME_PRESSURE_QUEUE_DEPTH',
        DEFAULT_QUEUE_DEPTH_THRESHOLD,
        1,
        1_000,
      ),
      apiLatencyMs: this.readNumberFromEnv(
        'RUNTIME_PRESSURE_API_LATENCY_MS',
        DEFAULT_API_LATENCY_THRESHOLD_MS,
        100,
        60_000,
      ),
      ioLowUtilization: this.readRatioFromEnv(
        'RUNTIME_PRESSURE_IO_LOW_UTILIZATION',
        DEFAULT_IO_LOW_UTILIZATION_THRESHOLD,
      ),
      minAdaptiveThrottleFactor: this.readRatioFromEnv(
        'RUNTIME_PRESSURE_MIN_ADAPTIVE_THROTTLE_FACTOR',
        DEFAULT_MIN_ADAPTIVE_THROTTLE_FACTOR,
      ),
    };
  }

  private readNumberFromEnv(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(process.env[key]);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Number(Math.max(min, Math.min(max, parsed)).toFixed(2));
  }

  private readRatioFromEnv(key: string, fallback: number): number {
    const parsed = Number(process.env[key]);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Number(Math.max(0.05, Math.min(1, parsed)).toFixed(4));
  }

  private nsToMs(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Number((value / 1_000_000).toFixed(2));
  }

  private normalizeUtilization(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }

    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * percentile) - 1),
    );
    return Number(sorted[index].toFixed(2));
  }
}
