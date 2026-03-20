import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import type { RuntimePressureCause, RuntimePressureSnapshot } from './runtime-pressure.service';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
import { OperationalObservabilityService } from './operational-observability.service';
import { RuntimePressureService } from './runtime-pressure.service';

type SharedLoadReport = {
  instanceId: string;
  updatedAt: number;
  adaptiveThrottleFactor: number;
  overloaded: boolean;
  cause: RuntimePressureCause;
  pressureScore: number;
  recentApiLatencyMs: number | null;
  queueDepth: number;
};

type GranularPressureSignal = 'rate_limit' | 'queue_rejected' | 'queue_timeout' | 'runtime_pressure';

type GranularRouteTenantPressureState = {
  routePolicyId: string;
  tenantId: string | null;
  updatedAt: number;
  signalScore: number;
  rateLimitEvents: number;
  queueRejectedEvents: number;
  queueTimeoutEvents: number;
  runtimePressureEvents: number;
  lastSignal: GranularPressureSignal;
};

export type OperationalLoadSheddingSnapshot = {
  instanceId: string;
  instanceCount: number;
  overloadedInstances: number;
  adaptiveThrottleFactor: number;
  desiredAdaptiveThrottleFactor: number;
  pressureCause: RuntimePressureCause | 'cluster';
  stateConsistency: 'distributed' | 'local_fallback';
  local: RuntimePressureSnapshot;
  clusterRecentApiLatencyMs: number | null;
  clusterQueueDepth: number;
  mitigation: {
    degradeHeavyFeatures: boolean;
    disableRemoteUpdateChecks: boolean;
    rejectHeavyMutations: boolean;
    featureFlags: string[];
    businessImpact: string[];
  };
};

const LOAD_SHEDDING_INSTANCES_KEY = 'operational-load-shedding:instances';
const LOAD_SHEDDING_REPORT_PREFIX = 'operational-load-shedding:instance:';
const LOAD_SHEDDING_GRANULAR_PREFIX = 'operational-load-shedding:granular:';
const LOAD_SHEDDING_TTL_MS = 10_000;
const LOAD_SHEDDING_SAMPLE_MS = 1_000;
const LOAD_SHEDDING_GRANULAR_TTL_MS = 60_000;
const LOAD_SHEDDING_GRANULAR_DECAY_STEP_MS = 15_000;
const LOAD_SHEDDING_GRANULAR_DECAY_POINTS = 1;
const LOAD_SHEDDING_EMA_DOWN_ALPHA = 0.45;
const LOAD_SHEDDING_EMA_UP_ALPHA = 0.2;
const LOAD_SHEDDING_MIN_STEP_UP = 0.05;
const LOAD_SHEDDING_RECOVERY_STABLE_SAMPLES = 3;

@Injectable()
export class OperationalLoadSheddingService implements OnModuleDestroy {
  private readonly instanceId =
    process.env.NODE_APP_INSTANCE ||
    process.env.HOSTNAME ||
    `instance-${process.pid}`;
  private stableRecoverySamples = 0;
  private latestSnapshot: OperationalLoadSheddingSnapshot;
  private readonly samplingTimer: NodeJS.Timeout;

  constructor(
    private readonly runtimePressureService: RuntimePressureService,
    private readonly distributedOperationalStateService: DistributedOperationalStateService,
    private readonly operationalObservabilityService: OperationalObservabilityService,
  ) {
    const local = this.runtimePressureService.getSnapshot();
    this.latestSnapshot = {
      instanceId: this.instanceId,
      instanceCount: 1,
      overloadedInstances: local.overloaded ? 1 : 0,
      adaptiveThrottleFactor: local.adaptiveThrottleFactor,
      desiredAdaptiveThrottleFactor: local.adaptiveThrottleFactor,
      pressureCause: local.cause,
      stateConsistency: 'local_fallback',
      local,
      clusterRecentApiLatencyMs: local.recentApiLatencyMs,
      clusterQueueDepth: local.queueDepth,
      mitigation: {
        degradeHeavyFeatures: false,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
        featureFlags: [],
        businessImpact: [],
      },
    };

    this.samplingTimer = setInterval(() => {
      void this.refreshSnapshot();
    }, LOAD_SHEDDING_SAMPLE_MS);
    this.samplingTimer.unref?.();
    void this.refreshSnapshot();
  }

  onModuleDestroy(): void {
    clearInterval(this.samplingTimer);
  }

  getSnapshot(): OperationalLoadSheddingSnapshot {
    return {
      ...this.latestSnapshot,
      local: { ...this.latestSnapshot.local },
      mitigation: {
        ...this.latestSnapshot.mitigation,
        featureFlags: [...this.latestSnapshot.mitigation.featureFlags],
        businessImpact: [...this.latestSnapshot.mitigation.businessImpact],
      },
    };
  }

  async recordGranularPressure(input: {
    path: string;
    tenantId?: string | null;
    signal: GranularPressureSignal;
    weight?: number;
  }): Promise<void> {
    const routePolicy = resolveApiRouteContractPolicy(input.path);
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const weight = this.resolveGranularSignalWeight(routePolicy.id, input.signal, input.weight);
    const key = this.getGranularStateKey(routePolicy.id, normalizedTenantId);

    await this.distributedOperationalStateService.mutateJson<
      GranularRouteTenantPressureState,
      void
    >(
      key,
      {
        seed: {
          routePolicyId: routePolicy.id,
          tenantId: normalizedTenantId,
          updatedAt: 0,
          signalScore: 0,
          rateLimitEvents: 0,
          queueRejectedEvents: 0,
          queueTimeoutEvents: 0,
          runtimePressureEvents: 0,
          lastSignal: input.signal,
        },
        ttlMs: LOAD_SHEDDING_GRANULAR_TTL_MS,
      },
      (state) => {
        this.applyGranularDecay(state, Date.now());
        state.updatedAt = Date.now();
        state.signalScore = Math.min(20, state.signalScore + weight);
        state.lastSignal = input.signal;

        if (input.signal === 'rate_limit') {
          state.rateLimitEvents += 1;
        } else if (input.signal === 'queue_rejected') {
          state.queueRejectedEvents += 1;
        } else if (input.signal === 'queue_timeout') {
          state.queueTimeoutEvents += 1;
        } else {
          state.runtimePressureEvents += 1;
        }

        return {
          next: state,
          result: undefined,
        };
      },
    );
  }

  async resolveAdaptiveRateLimitContext(path: string, tenantId?: string | null): Promise<{
    factor: number;
    cause: string | null;
    scope: 'cluster' | 'tenant-route';
    signalScore: number;
  }> {
    const routePolicy = resolveApiRouteContractPolicy(path);
    const clusterSnapshot = this.getSnapshot();
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const granularState = await this.distributedOperationalStateService.readJson<GranularRouteTenantPressureState>(
      this.getGranularStateKey(routePolicy.id, normalizedTenantId),
    );
    const effectiveGranularState = granularState
      ? this.getDecayedGranularState(granularState, Date.now())
      : null;

    let granularFactor = 1;
    if (effectiveGranularState?.signalScore && effectiveGranularState.signalScore >= 9) {
      granularFactor = 0.55;
    } else if (effectiveGranularState?.signalScore && effectiveGranularState.signalScore >= 6) {
      granularFactor = 0.75;
    } else if (effectiveGranularState?.signalScore && effectiveGranularState.signalScore >= 3) {
      granularFactor = 0.9;
    }

    const clusterFactor =
      clusterSnapshot.overloadedInstances > 0 || clusterSnapshot.adaptiveThrottleFactor < 1
        ? clusterSnapshot.adaptiveThrottleFactor
        : 1;
    const factor = Number(Math.min(clusterFactor, granularFactor).toFixed(2));

    if (factor >= 1) {
      return {
        factor: 1,
        cause: null,
        scope: 'cluster',
        signalScore: effectiveGranularState?.signalScore || 0,
      };
    }

    if (granularFactor < clusterFactor) {
      return {
        factor,
        cause: `tenant-route:${routePolicy.id}`,
        scope: 'tenant-route',
        signalScore: effectiveGranularState?.signalScore || 0,
      };
    }

    return {
      factor,
      cause: clusterSnapshot.pressureCause,
      scope: 'cluster',
      signalScore: effectiveGranularState?.signalScore || 0,
    };
  }

  private async refreshSnapshot() {
    const local = this.runtimePressureService.getSnapshot();
    const localReport: SharedLoadReport = {
      instanceId: this.instanceId,
      updatedAt: Date.now(),
      adaptiveThrottleFactor: local.adaptiveThrottleFactor,
      overloaded: local.overloaded,
      cause: local.cause,
      pressureScore: local.pressureScore,
      recentApiLatencyMs: local.recentApiLatencyMs,
      queueDepth: local.queueDepth,
    };

    await Promise.all([
      this.distributedOperationalStateService.writeJson(
        this.getReportKey(this.instanceId),
        localReport,
        LOAD_SHEDDING_TTL_MS,
      ),
      this.distributedOperationalStateService.addSetMember(
        LOAD_SHEDDING_INSTANCES_KEY,
        this.instanceId,
      ),
    ]);

    const instanceIds = await this.distributedOperationalStateService.listSetMembers(
      LOAD_SHEDDING_INSTANCES_KEY,
    );
    const reports = (
      await this.distributedOperationalStateService.readJsonBatch<SharedLoadReport>(
        instanceIds.map((instanceId) => this.getReportKey(instanceId)),
      )
    )
      .map(({ key, value }) => {
        if (!value) {
          const missingInstanceId = key.replace(LOAD_SHEDDING_REPORT_PREFIX, '');
          void this.distributedOperationalStateService.removeSetMember(
            LOAD_SHEDDING_INSTANCES_KEY,
            missingInstanceId,
          );
        }
        return value;
      })
      .filter((entry): entry is SharedLoadReport => Boolean(entry));

    const desiredAdaptiveThrottleFactor = this.resolveDesiredAdaptiveFactor(reports, local);
    const adaptiveThrottleFactor = this.applySmoothing(desiredAdaptiveThrottleFactor);
    const overloadedInstances = reports.filter((entry) => entry.overloaded).length;
    const instanceCount = Math.max(1, reports.length);
    const clusterQueueDepth = reports.reduce((sum, entry) => sum + Math.max(0, entry.queueDepth), 0);
    const clusterRecentApiLatencyMs = this.average(
      reports
        .map((entry) => entry.recentApiLatencyMs)
        .filter((value): value is number => Number.isFinite(value)),
    );
    const pressureCause = this.resolvePressureCause(reports, local);
    const stateConsistency = this.distributedOperationalStateService.isDistributedReady()
      ? 'distributed'
      : 'local_fallback';
    const featureFlags = this.resolveMitigationFeatureFlags({
      adaptiveThrottleFactor,
      overloadedInstances,
      instanceCount,
      clusterRecentApiLatencyMs,
      clusterQueueDepth,
      stateConsistency,
    });
    const businessImpact = this.resolveMitigationBusinessImpact(featureFlags);
    const mitigation = {
      degradeHeavyFeatures: featureFlags.includes('degrade-heavy-features'),
      disableRemoteUpdateChecks: featureFlags.includes('disable-remote-update-checks'),
      rejectHeavyMutations: featureFlags.includes('reject-heavy-mutations'),
      featureFlags,
      businessImpact,
    };

    const previousSnapshot = this.latestSnapshot;
    this.latestSnapshot = {
      instanceId: this.instanceId,
      instanceCount,
      overloadedInstances,
      adaptiveThrottleFactor,
      desiredAdaptiveThrottleFactor,
      pressureCause,
      stateConsistency,
      local,
      clusterRecentApiLatencyMs,
      clusterQueueDepth,
      mitigation,
    };

    if (
      previousSnapshot.adaptiveThrottleFactor !== adaptiveThrottleFactor ||
      previousSnapshot.mitigation.degradeHeavyFeatures !== mitigation.degradeHeavyFeatures ||
      previousSnapshot.mitigation.disableRemoteUpdateChecks !== mitigation.disableRemoteUpdateChecks ||
      previousSnapshot.mitigation.rejectHeavyMutations !== mitigation.rejectHeavyMutations
    ) {
      this.operationalObservabilityService.record({
        type: 'auto_mitigation',
        route: '/system/runtime/load-shedding',
        severity: mitigation.rejectHeavyMutations ? 'warn' : 'log',
        detail: `adaptive load shedding factor=${adaptiveThrottleFactor} desired=${desiredAdaptiveThrottleFactor} overloadedInstances=${overloadedInstances}/${instanceCount}`,
        extra: {
          instanceId: this.instanceId,
          instanceCount,
          overloadedInstances,
          adaptiveThrottleFactor,
          desiredAdaptiveThrottleFactor,
          pressureCause,
          stateConsistency,
          clusterQueueDepth,
          clusterRecentApiLatencyMs,
          mitigation,
          distributed: this.distributedOperationalStateService.isDistributedReady(),
        },
      });
    }
  }

  private resolveDesiredAdaptiveFactor(
    reports: SharedLoadReport[],
    local: RuntimePressureSnapshot,
  ): number {
    const factors = reports
      .map((entry) => entry.adaptiveThrottleFactor)
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 1);
    const worstPeerFactor = factors.length > 0 ? Math.min(...factors) : local.adaptiveThrottleFactor;
    const averagePeerFactor = this.average(factors) ?? local.adaptiveThrottleFactor;
    const overloadedInstances = reports.filter((entry) => entry.overloaded).length;
    const overloadedRatio = reports.length > 0 ? overloadedInstances / reports.length : 0;
    const averageLatency = this.average(
      reports
        .map((entry) => entry.recentApiLatencyMs)
        .filter((value): value is number => Number.isFinite(value)),
    );
    const totalQueueDepth = reports.reduce((sum, entry) => sum + Math.max(0, entry.queueDepth), 0);

    let desiredFactor = local.adaptiveThrottleFactor;
    if (overloadedRatio >= 0.5) {
      desiredFactor = Math.min(desiredFactor, worstPeerFactor);
    } else if (overloadedRatio >= 0.25) {
      desiredFactor = Math.min(desiredFactor, Math.min(averagePeerFactor, 0.78));
    } else if (overloadedRatio > 0) {
      desiredFactor = Math.min(desiredFactor, 0.9);
    }

    if (averageLatency !== null && averageLatency >= 3_000) {
      desiredFactor = Math.min(desiredFactor, 0.5);
    } else if (averageLatency !== null && averageLatency >= 1_800) {
      desiredFactor = Math.min(desiredFactor, 0.7);
    }

    if (totalQueueDepth >= 8) {
      desiredFactor = Math.min(desiredFactor, 0.55);
    } else if (totalQueueDepth >= 4) {
      desiredFactor = Math.min(desiredFactor, 0.75);
    }

    return Number(Math.max(0.35, Math.min(1, desiredFactor)).toFixed(2));
  }

  private applySmoothing(desiredFactor: number): number {
    const previousFactor = this.latestSnapshot.adaptiveThrottleFactor;

    if (desiredFactor < previousFactor - 0.01) {
      this.stableRecoverySamples = 0;
      return Number(
        (
          previousFactor +
          (desiredFactor - previousFactor) * LOAD_SHEDDING_EMA_DOWN_ALPHA
        ).toFixed(2),
      );
    }

    if (desiredFactor > previousFactor + 0.01) {
      this.stableRecoverySamples += 1;
      if (this.stableRecoverySamples < LOAD_SHEDDING_RECOVERY_STABLE_SAMPLES) {
        return previousFactor;
      }

      const emaTarget = Number(
        (
          previousFactor +
          (desiredFactor - previousFactor) * LOAD_SHEDDING_EMA_UP_ALPHA
        ).toFixed(2),
      );
      return Number(
        Math.min(1, Math.max(previousFactor + LOAD_SHEDDING_MIN_STEP_UP, emaTarget)).toFixed(2),
      );
    }

    return previousFactor;
  }

  private resolvePressureCause(
    reports: SharedLoadReport[],
    local: RuntimePressureSnapshot,
  ): RuntimePressureCause | 'cluster' {
    const overloadedCauses = reports
      .filter((entry) => entry.overloaded && entry.cause !== 'normal')
      .map((entry) => entry.cause);

    if (overloadedCauses.length === 0) {
      return local.cause;
    }

    const uniqueCauses = [...new Set(overloadedCauses)];
    if (uniqueCauses.length === 1) {
      return uniqueCauses[0];
    }

    return 'cluster';
  }

  private resolveMitigationFeatureFlags(input: {
    adaptiveThrottleFactor: number;
    overloadedInstances: number;
    instanceCount: number;
    clusterRecentApiLatencyMs: number | null;
    clusterQueueDepth: number;
    stateConsistency: 'distributed' | 'local_fallback';
  }): string[] {
    const flags: string[] = [];
    const overloadedRatio =
      input.instanceCount > 0 ? input.overloadedInstances / input.instanceCount : 0;

    if (input.stateConsistency === 'local_fallback') {
      flags.push('degrade-heavy-features');
    }

    if (
      input.adaptiveThrottleFactor <= 0.7 ||
      overloadedRatio >= 0.25 ||
      (input.clusterRecentApiLatencyMs || 0) >= 1_800 ||
      input.clusterQueueDepth >= 5
    ) {
      flags.push('degrade-heavy-features');
    }

    if (
      input.adaptiveThrottleFactor <= 0.6 ||
      overloadedRatio >= 0.4 ||
      (input.clusterRecentApiLatencyMs || 0) >= 2_600 ||
      input.clusterQueueDepth >= 8
    ) {
      flags.push('disable-remote-update-checks');
    }

    if (
      input.adaptiveThrottleFactor <= 0.45 ||
      overloadedRatio >= 0.6 ||
      input.clusterQueueDepth >= 12
    ) {
      flags.push('reject-heavy-mutations');
    }

    if (!this.distributedOperationalStateService.isDistributedReady()) {
      flags.push('redis-fallback-visible');
    }

    return flags;
  }

  private resolveMitigationBusinessImpact(featureFlags: string[]): string[] {
    const impacts: string[] = [];

    if (featureFlags.includes('degrade-heavy-features')) {
      impacts.push('Widgets pesados do dashboard e agregacoes caras podem operar em modo reduzido.');
    }
    if (featureFlags.includes('disable-remote-update-checks')) {
      impacts.push('Verificacoes remotas de atualizacao ficam temporariamente suspensas.');
    }
    if (featureFlags.includes('reject-heavy-mutations')) {
      impacts.push('Operacoes mutantes pesadas podem ser recusadas para preservar o cluster.');
    }
    if (featureFlags.includes('redis-fallback-visible')) {
      impacts.push('Coordenacao distribuida esta em fallback local; consistencia global reduzida ate a recuperacao do Redis.');
    }

    return impacts;
  }

  private average(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((total, value) => total + value, 0);
    return Number((sum / values.length).toFixed(2));
  }

  private getReportKey(instanceId: string) {
    return `${LOAD_SHEDDING_REPORT_PREFIX}${instanceId}`;
  }

  private getGranularStateKey(routePolicyId: string, tenantId: string | null) {
    return `${LOAD_SHEDDING_GRANULAR_PREFIX}${routePolicyId}:${tenantId || 'anonymous'}`;
  }

  private applyGranularDecay(state: GranularRouteTenantPressureState, now: number) {
    if (!state.updatedAt || state.updatedAt >= now) {
      return;
    }

    const elapsedMs = now - state.updatedAt;
    const decaySteps = Math.floor(elapsedMs / LOAD_SHEDDING_GRANULAR_DECAY_STEP_MS);
    if (decaySteps <= 0) {
      return;
    }

    state.signalScore = Math.max(
      0,
      state.signalScore - decaySteps * LOAD_SHEDDING_GRANULAR_DECAY_POINTS,
    );
  }

  private getDecayedGranularState(
    state: GranularRouteTenantPressureState,
    now: number,
  ): GranularRouteTenantPressureState {
    const cloned = { ...state };
    this.applyGranularDecay(cloned, now);
    return cloned;
  }

  private resolveGranularSignalWeight(
    routePolicyId: string,
    signal: GranularPressureSignal,
    requestedWeight?: number,
  ): number {
    const baseWeight = Math.max(1, Math.min(5, Math.floor(requestedWeight || 1)));

    if (signal === 'runtime_pressure') {
      return Math.max(baseWeight, 3);
    }

    if (signal === 'queue_timeout') {
      return Math.max(baseWeight, 2);
    }

    if (signal === 'queue_rejected') {
      return routePolicyId === 'backup-update-audit' || routePolicyId === 'cron-system-settings'
        ? Math.max(baseWeight, 3)
        : Math.max(baseWeight, 2);
    }

    return baseWeight;
  }

  private normalizeTenantId(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }
}
