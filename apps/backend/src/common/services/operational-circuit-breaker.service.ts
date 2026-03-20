import { Injectable } from '@nestjs/common';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
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
  failureVotes: Record<string, number>;
  recoveryVotes: Record<string, number>;
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
  failureQuorum?: number;
  recoveryQuorum?: number;
  voteWindowMs?: number;
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
  failureVoters: number;
  recoveryVoters: number;
};

type CircuitPreflightResult =
  | {
      status: 'blocked';
      retryAfterMs: number;
      snapshot: CircuitBreakerSnapshot;
    }
  | {
      status: 'execute';
      enteredHalfOpen: boolean;
      halfOpenMaxProbes: number;
      halfOpenSuccessThreshold: number;
      snapshot: CircuitBreakerSnapshot;
    };

type CircuitFinalizeResult = {
  snapshot: CircuitBreakerSnapshot;
  becameOpen: boolean;
  recovered: boolean;
  openedUntil: number | null;
};

const DEFAULT_HALF_OPEN_MAX_PROBES = 1;
const DEFAULT_JITTER_RATIO = 0.2;
const DEFAULT_VOTE_WINDOW_MS = 30_000;
const CIRCUIT_STATE_TTL_MS = 6 * 60 * 60 * 1000;
const CIRCUIT_STATE_PREFIX = 'operational-circuit-breaker:';

@Injectable()
export class OperationalCircuitBreakerService {
  private readonly snapshots = new Map<string, CircuitBreakerSnapshot>();
  private readonly instanceId =
    process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || `instance-${process.pid}`;

  constructor(
    private readonly operationalObservabilityService: OperationalObservabilityService,
    private readonly distributedOperationalStateService: DistributedOperationalStateService,
  ) {}

  async execute<T>(options: ExecuteCircuitOptions, action: () => Promise<T>): Promise<T> {
    const halfOpenMaxProbes = Math.max(1, options.halfOpenMaxProbes || DEFAULT_HALF_OPEN_MAX_PROBES);
    const halfOpenSuccessThreshold = Math.max(
      1,
      Math.min(halfOpenMaxProbes, options.halfOpenSuccessThreshold || halfOpenMaxProbes),
    );
    const failureQuorum = Math.max(1, options.failureQuorum || this.readQuorumFromEnv('OPS_CIRCUIT_BREAKER_FAILURE_QUORUM', 1));
    const recoveryQuorum = Math.max(1, options.recoveryQuorum || this.readQuorumFromEnv('OPS_CIRCUIT_BREAKER_RECOVERY_QUORUM', failureQuorum));
    const voteWindowMs = Math.max(1_000, options.voteWindowMs || DEFAULT_VOTE_WINDOW_MS);

    const preflight = await this.distributedOperationalStateService.mutateJson<
      CircuitBreakerState,
      CircuitPreflightResult
    >(
      this.getStateKey(options.key),
      {
        seed: this.createState(),
        ttlMs: CIRCUIT_STATE_TTL_MS,
      },
      (state) => {
        const now = Date.now();
        this.pruneVotes(state, now, voteWindowMs);

        if (state.mode === 'open' && state.openedUntil && now < state.openedUntil) {
          return {
            next: state,
            result: {
              status: 'blocked',
              retryAfterMs: Math.max(1, state.openedUntil - now),
              snapshot: this.toSnapshot(options.key, state),
            },
          };
        }

        let enteredHalfOpen = false;
        if (state.mode === 'open' && state.openedUntil && now >= state.openedUntil) {
          this.transitionToHalfOpen(state);
          enteredHalfOpen = true;
        }

        if (
          state.mode === 'half-open' &&
          (state.halfOpenInFlight >= halfOpenMaxProbes ||
            state.halfOpenProbeAttempts >= halfOpenMaxProbes)
        ) {
          return {
            next: state,
            result: {
              status: 'blocked',
              retryAfterMs: Math.max(250, Math.floor(options.resetTimeoutMs * 0.25)),
              snapshot: this.toSnapshot(options.key, state),
            },
          };
        }

        if (state.mode === 'half-open') {
          state.halfOpenInFlight += 1;
          state.halfOpenProbeAttempts += 1;
        }

        return {
          next: state,
          result: {
            status: 'execute',
            enteredHalfOpen,
            halfOpenMaxProbes,
            halfOpenSuccessThreshold,
            snapshot: this.toSnapshot(options.key, state),
          },
        };
      },
    );

    this.updateSnapshot(preflight.snapshot);

    if (preflight.status === 'blocked') {
      this.operationalObservabilityService.record({
        type: 'circuit_open',
        route: options.route,
        request: options.request,
        severity: 'warn',
        detail: `circuit open key=${options.key} retryAfterMs=${preflight.retryAfterMs}`,
        extra: {
          key: options.key,
          mode: preflight.snapshot.mode,
          retryAfterMs: preflight.retryAfterMs,
          openCount: preflight.snapshot.openCount,
          distributed: this.distributedOperationalStateService.isDistributedReady(),
        },
      });
      throw new CircuitBreakerOpenError(options.key, preflight.retryAfterMs);
    }

        if (preflight.enteredHalfOpen) {
      this.operationalObservabilityService.record({
        type: 'circuit_half_open',
        route: options.route,
        request: options.request,
        severity: 'warn',
        detail: `circuit half-open key=${options.key} probes=${preflight.halfOpenMaxProbes}`,
          extra: {
            key: options.key,
            halfOpenMaxProbes: preflight.halfOpenMaxProbes,
            halfOpenSuccessThreshold: preflight.halfOpenSuccessThreshold,
            failureQuorum,
            recoveryQuorum,
            openCount: preflight.snapshot.openCount,
            distributed: this.distributedOperationalStateService.isDistributedReady(),
          },
      });
    }

    try {
      const result = await action();
      const finalized = await this.distributedOperationalStateService.mutateJson<
        CircuitBreakerState,
        CircuitFinalizeResult
      >(
        this.getStateKey(options.key),
        {
          seed: this.createState(),
          ttlMs: CIRCUIT_STATE_TTL_MS,
        },
        (state) => {
          let recovered = false;
          const now = Date.now();
          this.pruneVotes(state, now, voteWindowMs);
          state.recoveryVotes[this.instanceId] = now;
          delete state.failureVotes[this.instanceId];

          if (state.mode === 'half-open') {
            state.halfOpenInFlight = Math.max(0, state.halfOpenInFlight - 1);
            state.halfOpenSuccesses += 1;
            state.consecutiveSuccesses += 1;

            if (
              state.halfOpenSuccesses >= preflight.halfOpenSuccessThreshold &&
              this.countVotes(state.recoveryVotes) >= recoveryQuorum
            ) {
              this.closeCircuit(state, true);
              recovered = true;
            }
          } else {
            if (state.failures > 0 || state.openCount > 0) {
              recovered = true;
              state.consecutiveSuccesses += 1;
              state.failures = Math.max(0, state.failures - 1);
              state.openCount = Math.max(0, state.openCount - 1);
            }
            this.closeCircuit(state, false);
          }

          return {
            next: state,
            result: {
              snapshot: this.toSnapshot(options.key, state),
              becameOpen: false,
              recovered,
              openedUntil: state.openedUntil,
            },
          };
        },
      );

      this.updateSnapshot(finalized.snapshot);
      if (finalized.recovered) {
        this.operationalObservabilityService.record({
          type: 'circuit_recovered',
          route: options.route,
          request: options.request,
          severity: 'log',
          detail: `circuit recovered key=${options.key}`,
          extra: {
            key: options.key,
            openCount: finalized.snapshot.openCount,
            failures: finalized.snapshot.failures,
            recoveryVoters: finalized.snapshot.recoveryVoters,
            distributed: this.distributedOperationalStateService.isDistributedReady(),
          },
        });
      }

      return result;
    } catch (error) {
      const finalized = await this.distributedOperationalStateService.mutateJson<
        CircuitBreakerState,
        CircuitFinalizeResult
      >(
        this.getStateKey(options.key),
        {
          seed: this.createState(),
          ttlMs: CIRCUIT_STATE_TTL_MS,
        },
        (state) => {
          if (state.mode === 'half-open') {
            state.halfOpenInFlight = Math.max(0, state.halfOpenInFlight - 1);
          }

          const now = Date.now();
          this.pruneVotes(state, now, voteWindowMs);
          state.failureVotes[this.instanceId] = now;
          delete state.recoveryVotes[this.instanceId];
          state.consecutiveSuccesses = 0;
          state.failures += 1;
          const shouldOpen =
            state.mode === 'half-open' ||
            (state.failures >= Math.max(1, options.failureThreshold) &&
              this.countVotes(state.failureVotes) >= failureQuorum);

          let becameOpen = false;
          if (shouldOpen) {
            this.openCircuit(state, options);
            becameOpen = true;
          }

          return {
            next: state,
            result: {
              snapshot: this.toSnapshot(options.key, state),
              becameOpen,
              recovered: false,
              openedUntil: state.openedUntil,
            },
          };
        },
      );

      this.updateSnapshot(finalized.snapshot);
      if (finalized.becameOpen) {
        this.operationalObservabilityService.record({
          type: 'circuit_open',
          route: options.route,
          request: options.request,
          severity: 'warn',
          detail: `circuit opened key=${options.key} failures=${finalized.snapshot.failures} openCount=${finalized.snapshot.openCount}`,
          extra: {
            key: options.key,
            failures: finalized.snapshot.failures,
            openCount: finalized.snapshot.openCount,
            failureVoters: finalized.snapshot.failureVoters,
            failureQuorum,
            openedUntil: finalized.openedUntil,
            distributed: this.distributedOperationalStateService.isDistributedReady(),
          },
        });
      }

      throw error;
    }
  }

  getSnapshot(key: string): CircuitBreakerSnapshot {
    return (
      this.snapshots.get(key) || {
        key,
        mode: 'closed',
        failures: 0,
        openCount: 0,
        openedUntil: null,
        halfOpenInFlight: 0,
        halfOpenProbeAttempts: 0,
        halfOpenSuccesses: 0,
        consecutiveSuccesses: 0,
        lastTransitionAt: Date.now(),
        failureVoters: 0,
        recoveryVoters: 0,
      }
    );
  }

  reset(key: string): void {
    this.snapshots.delete(key);
    void this.distributedOperationalStateService.deleteKey(this.getStateKey(key));
  }

  private getStateKey(key: string) {
    return `${CIRCUIT_STATE_PREFIX}${key}`;
  }

  private updateSnapshot(snapshot: CircuitBreakerSnapshot) {
    this.snapshots.set(snapshot.key, snapshot);
  }

  private createState(): CircuitBreakerState {
    return {
      mode: 'closed',
      failures: 0,
      openCount: 0,
      openedUntil: null,
      halfOpenInFlight: 0,
      halfOpenProbeAttempts: 0,
      halfOpenSuccesses: 0,
      consecutiveSuccesses: 0,
      lastTransitionAt: Date.now(),
      failureVotes: {},
      recoveryVotes: {},
    };
  }

  private toSnapshot(key: string, state: CircuitBreakerState): CircuitBreakerSnapshot {
    return {
      key,
      mode: state.mode,
      failures: state.failures,
      openCount: state.openCount,
      openedUntil: state.openedUntil,
      halfOpenInFlight: state.halfOpenInFlight,
      halfOpenProbeAttempts: state.halfOpenProbeAttempts,
      halfOpenSuccesses: state.halfOpenSuccesses,
      consecutiveSuccesses: state.consecutiveSuccesses,
      lastTransitionAt: state.lastTransitionAt,
      failureVoters: this.countVotes(state.failureVotes),
      recoveryVoters: this.countVotes(state.recoveryVotes),
    };
  }

  private openCircuit(entry: CircuitBreakerState, options: ExecuteCircuitOptions) {
    entry.mode = 'open';
    entry.openCount += 1;
    entry.halfOpenInFlight = 0;
    entry.halfOpenProbeAttempts = 0;
    entry.halfOpenSuccesses = 0;
    entry.lastTransitionAt = Date.now();
    entry.openedUntil =
      Date.now() +
      this.calculateCooldownMs(options.resetTimeoutMs, entry.openCount, options.jitterRatio);
    entry.recoveryVotes = {};
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
    entry.failureVotes = {};
    entry.recoveryVotes = {};
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

  private countVotes(votes: Record<string, number>): number {
    return Object.keys(votes).length;
  }

  private pruneVotes(
    state: CircuitBreakerState,
    now: number,
    voteWindowMs: number,
  ) {
    const cutoff = now - voteWindowMs;
    state.failureVotes = Object.fromEntries(
      Object.entries(state.failureVotes).filter(([, at]) => Number(at) >= cutoff),
    );
    state.recoveryVotes = Object.fromEntries(
      Object.entries(state.recoveryVotes).filter(([, at]) => Number(at) >= cutoff),
    );
  }

  private readQuorumFromEnv(key: string, fallback: number): number {
    const parsed = Number.parseInt(String(process.env[key] || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }
}
