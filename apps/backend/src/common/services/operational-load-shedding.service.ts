import { Injectable, OnModuleDestroy } from '@nestjs/common';
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

export type OperationalLoadSheddingSnapshot = {
  instanceId: string;
  instanceCount: number;
  overloadedInstances: number;
  adaptiveThrottleFactor: number;
  desiredAdaptiveThrottleFactor: number;
  pressureCause: RuntimePressureCause | 'cluster';
  local: RuntimePressureSnapshot;
  clusterRecentApiLatencyMs: number | null;
  clusterQueueDepth: number;
  mitigation: {
    degradeHeavyFeatures: boolean;
    disableRemoteUpdateChecks: boolean;
    rejectHeavyMutations: boolean;
  };
};

const LOAD_SHEDDING_INSTANCES_KEY = 'operational-load-shedding:instances';
const LOAD_SHEDDING_REPORT_PREFIX = 'operational-load-shedding:instance:';
const LOAD_SHEDDING_TTL_MS = 10_000;
const LOAD_SHEDDING_SAMPLE_MS = 1_000;
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
      local,
      clusterRecentApiLatencyMs: local.recentApiLatencyMs,
      clusterQueueDepth: local.queueDepth,
      mitigation: {
        degradeHeavyFeatures: false,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
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
      mitigation: { ...this.latestSnapshot.mitigation },
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
    const mitigation = {
      degradeHeavyFeatures:
        adaptiveThrottleFactor <= 0.75 ||
        overloadedInstances > 0 ||
        (clusterRecentApiLatencyMs || 0) >= 1_500 ||
        clusterQueueDepth >= 3,
      disableRemoteUpdateChecks:
        adaptiveThrottleFactor <= 0.65 ||
        overloadedInstances > 0 ||
        (clusterRecentApiLatencyMs || 0) >= 2_000,
      rejectHeavyMutations:
        adaptiveThrottleFactor <= 0.5 ||
        overloadedInstances >= Math.max(1, Math.ceil(instanceCount / 2)),
    };

    const previousSnapshot = this.latestSnapshot;
    this.latestSnapshot = {
      instanceId: this.instanceId,
      instanceCount,
      overloadedInstances,
      adaptiveThrottleFactor,
      desiredAdaptiveThrottleFactor,
      pressureCause,
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
    const averageLatency = this.average(
      reports
        .map((entry) => entry.recentApiLatencyMs)
        .filter((value): value is number => Number.isFinite(value)),
    );
    const totalQueueDepth = reports.reduce((sum, entry) => sum + Math.max(0, entry.queueDepth), 0);

    let desiredFactor = Math.min(local.adaptiveThrottleFactor, worstPeerFactor);
    if (averageLatency !== null && averageLatency >= 2_500) {
      desiredFactor = Math.min(desiredFactor, 0.45);
    } else if (averageLatency !== null && averageLatency >= 1_500) {
      desiredFactor = Math.min(desiredFactor, 0.6);
    }

    if (totalQueueDepth >= 6) {
      desiredFactor = Math.min(desiredFactor, 0.5);
    } else if (totalQueueDepth >= 3) {
      desiredFactor = Math.min(desiredFactor, 0.7);
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
}
