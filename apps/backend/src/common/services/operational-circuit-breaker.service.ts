import { Injectable } from '@nestjs/common';
import { OperationalObservabilityService } from './operational-observability.service';

export class CircuitBreakerOpenError extends Error {
  constructor(
    readonly key: string,
    readonly retryAfterMs: number,
  ) {
    super(`Circuit breaker aberto para ${key}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

type CircuitBreakerMode = 'closed' | 'open' | 'half-open';

type CircuitBreakerState = {
  mode: CircuitBreakerMode;
  failures: number;
  openCount: number;
  openedUntil: number | null;
  halfOpenInFlight: number;
  halfOpenProbeAttempts: number;
  halfOpenSuccesses: number;
  consecutiveSuccesses: number;
  lastTransitionAt: number;
};

type ExecuteCircuitOptions = {
  key: string;
  route: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  request?: Record<string, any>;
  halfOpenMaxProbes?: number;
  halfOpenSuccessThreshold?: number;
  jitterRatio?: number;
};

export type CircuitBreakerSnapshot = {
  key: string;
  mode: CircuitBreakerMode;
  failures: number;
  openCount: number;
  openedUntil: number | null;
  halfOpenInFlight: number;
  halfOpenProbeAttempts: number;
  halfOpenSuccesses: number;
  consecutiveSuccesses: number;
  lastTransitionAt: number;
};

const DEFAULT_HALF_OPEN_MAX_PROBES = 1;
const DEFAULT_JITTER_RATIO = 0.2;

@Injectable()
export class OperationalCircuitBreakerService {
  private readonly state = new Map<string, CircuitBreakerState>();

  constructor(
    private readonly operationalObservabilityService: OperationalObservabilityService,
  ) {}

  async execute<T>(options: ExecuteCircuitOptions, action: () => Promise<T>): Promise<T> {
    const entry = this.getState(options.key);
    const now = Date.now();
    const halfOpenMaxProbes = Math.max(1, options.halfOpenMaxProbes || DEFAULT_HALF_OPEN_MAX_PROBES);
    const halfOpenSuccessThreshold = Math.max(
      1,
      Math.min(halfOpenMaxProbes, options.halfOpenSuccessThreshold || halfOpenMaxProbes),
    );

    if (entry.mode === 'open' && entry.openedUntil && now < entry.openedUntil) {
      const retryAfterMs = Math.max(1, entry.openedUntil - now);
      this.operationalObservabilityService.record({
        type: 'circuit_open',
        route: options.route,
        request: options.request,
        severity: 'warn',
        detail: `circuit open key=${options.key} retryAfterMs=${retryAfterMs}`,
        extra: {
          key: options.key,
          mode: entry.mode,
          retryAfterMs,
          openCount: entry.openCount,
        },
      });
      throw new CircuitBreakerOpenError(options.key, retryAfterMs);
    }

    if (entry.mode === 'open' && entry.openedUntil && now >= entry.openedUntil) {
      this.transitionToHalfOpen(entry);
      this.operationalObservabilityService.record({
        type: 'circuit_half_open',
        route: options.route,
        request: options.request,
        severity: 'warn',
        detail: `circuit half-open key=${options.key} probes=${halfOpenMaxProbes}`,
        extra: {
          key: options.key,
          halfOpenMaxProbes,
          halfOpenSuccessThreshold,
          openCount: entry.openCount,
        },
      });
    }

    if (
      entry.mode === 'half-open' &&
      (entry.halfOpenInFlight >= halfOpenMaxProbes ||
        entry.halfOpenProbeAttempts >= halfOpenMaxProbes)
    ) {
      throw new CircuitBreakerOpenError(
        options.key,
        Math.max(250, Math.floor(options.resetTimeoutMs * 0.25)),
      );
    }

    if (entry.mode === 'half-open') {
      entry.halfOpenInFlight += 1;
      entry.halfOpenProbeAttempts += 1;
    }

    try {
      const result = await action();

      if (entry.mode === 'half-open') {
        entry.halfOpenInFlight = Math.max(0, entry.halfOpenInFlight - 1);
        entry.halfOpenSuccesses += 1;
        entry.consecutiveSuccesses += 1;

        if (entry.halfOpenSuccesses >= halfOpenSuccessThreshold) {
          this.closeCircuit(entry, true);
          this.operationalObservabilityService.record({
            type: 'circuit_recovered',
            route: options.route,
            request: options.request,
            severity: 'log',
            detail: `circuit recovered key=${options.key} probes=${halfOpenSuccessThreshold}`,
            extra: {
              key: options.key,
              halfOpenSuccessThreshold,
              openCount: entry.openCount,
            },
          });
        }

        return result;
      }

      if (entry.failures > 0 || entry.openCount > 0) {
        entry.consecutiveSuccesses += 1;
        entry.failures = Math.max(0, entry.failures - 1);
        entry.openCount = Math.max(0, entry.openCount - 1);
        this.operationalObservabilityService.record({
          type: 'circuit_recovered',
          route: options.route,
          request: options.request,
          severity: 'log',
          detail: `circuit recovered key=${options.key}`,
          extra: {
            key: options.key,
            remainingFailures: entry.failures,
            remainingOpenCount: entry.openCount,
          },
        });
      }

      this.closeCircuit(entry, false);
      return result;
    } catch (error) {
      if (entry.mode === 'half-open') {
        entry.halfOpenInFlight = Math.max(0, entry.halfOpenInFlight - 1);
      }

      entry.consecutiveSuccesses = 0;
      entry.failures += 1;
      const shouldOpen = entry.mode === 'half-open' || entry.failures >= Math.max(1, options.failureThreshold);

      if (shouldOpen) {
        this.openCircuit(entry, options);
      }

      throw error;
    }
  }

  getSnapshot(key: string): CircuitBreakerSnapshot {
    const entry = this.getState(key);
    return {
      key,
      mode: entry.mode,
      failures: entry.failures,
      openCount: entry.openCount,
      openedUntil: entry.openedUntil,
      halfOpenInFlight: entry.halfOpenInFlight,
      halfOpenProbeAttempts: entry.halfOpenProbeAttempts,
      halfOpenSuccesses: entry.halfOpenSuccesses,
      consecutiveSuccesses: entry.consecutiveSuccesses,
      lastTransitionAt: entry.lastTransitionAt,
    };
  }

  reset(key: string): void {
    this.state.delete(key);
  }

  private openCircuit(entry: CircuitBreakerState, options: ExecuteCircuitOptions) {
    entry.mode = 'open';
    entry.openCount += 1;
    entry.halfOpenInFlight = 0;
    entry.halfOpenProbeAttempts = 0;
    entry.halfOpenSuccesses = 0;
    entry.lastTransitionAt = Date.now();
    entry.openedUntil =
      Date.now() + this.calculateCooldownMs(options.resetTimeoutMs, entry.openCount, options.jitterRatio);

    this.operationalObservabilityService.record({
      type: 'circuit_open',
      route: options.route,
      request: options.request,
      severity: 'warn',
      detail: `circuit opened key=${options.key} failures=${entry.failures} openCount=${entry.openCount}`,
      extra: {
        key: options.key,
        failures: entry.failures,
        openCount: entry.openCount,
        openedUntil: entry.openedUntil,
      },
    });
  }

  private transitionToHalfOpen(entry: CircuitBreakerState) {
    entry.mode = 'half-open';
    entry.halfOpenInFlight = 0;
    entry.halfOpenProbeAttempts = 0;
    entry.halfOpenSuccesses = 0;
    entry.consecutiveSuccesses = 0;
    entry.lastTransitionAt = Date.now();
  }

  private closeCircuit(entry: CircuitBreakerState, fromHalfOpen: boolean) {
    entry.mode = 'closed';
    entry.failures = fromHalfOpen ? 0 : Math.max(0, entry.failures);
    entry.openCount = fromHalfOpen ? Math.max(0, entry.openCount - 1) : entry.openCount;
    entry.openedUntil = null;
    entry.halfOpenInFlight = 0;
    entry.halfOpenProbeAttempts = 0;
    entry.halfOpenSuccesses = 0;
    entry.lastTransitionAt = Date.now();
  }

  private calculateCooldownMs(
    resetTimeoutMs: number,
    openCount: number,
    jitterRatio = DEFAULT_JITTER_RATIO,
  ): number {
    const normalizedResetTimeoutMs = Math.max(250, Math.floor(resetTimeoutMs));
    const backoffMultiplier = 1 + Math.min(1.5, (openCount - 1) * 0.25);
    const baseDelay = normalizedResetTimeoutMs * backoffMultiplier;
    const jitterWindow = baseDelay * Math.max(0, Math.min(0.5, jitterRatio));
    const random = (Math.random() * 2 - 1) * jitterWindow;
    return Math.max(250, Math.floor(baseDelay + random));
  }

  private getState(key: string): CircuitBreakerState {
    const existing = this.state.get(key);
    if (existing) {
      return existing;
    }

    const nextState: CircuitBreakerState = {
      mode: 'closed',
      failures: 0,
      openCount: 0,
      openedUntil: null,
      halfOpenInFlight: 0,
      halfOpenProbeAttempts: 0,
      halfOpenSuccesses: 0,
      consecutiveSuccesses: 0,
      lastTransitionAt: Date.now(),
    };
    this.state.set(key, nextState);
    return nextState;
  }
}
