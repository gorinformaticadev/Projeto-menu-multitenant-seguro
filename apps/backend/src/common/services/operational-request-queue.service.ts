import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { FairQueueScope, RouteRuntimeProtectionPolicy } from '@contracts/api-routes';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
import { OperationalObservabilityService } from './operational-observability.service';

type QueueOptions = {
  routePolicyId: string;
  route: string;
  runtime: RouteRuntimeProtectionPolicy;
  request?: Record<string, any>;
};

type QueuePartitionIdentity = {
  partitionKey: string;
  tenantId: string | null;
  userId: string | null;
  clientIp: string | null;
};

type SharedQueueWaiter = {
  id: string;
  enqueuedAt: number;
  expiresAt: number;
  route: string;
  routePolicyId: string;
  partitionKey: string;
  tenantId: string | null;
  userId: string | null;
  clientIp: string | null;
};

type SharedQueuePartitionState = {
  key: string;
  tenantId: string | null;
  userId: string | null;
  clientIp: string | null;
  active: number;
  grantedCount: number;
  lastGrantedAt: number | null;
  queue: SharedQueueWaiter[];
};

type SharedQueueState = {
  active: number;
  partitions: Record<string, SharedQueuePartitionState>;
  maxConcurrentRequests: number;
  maxConcurrentPerPartition: number;
  maxQueueDepth: number;
  maxQueueDepthPerPartition: number;
};

export type OperationalRequestQueueSnapshot = {
  totalActive: number;
  totalQueued: number;
  routes: Array<{
    routePolicyId: string;
    active: number;
    queued: number;
    partitions: number;
  }>;
};

export type OperationalRequestQueueRouteDebugState = {
  routePolicyId: string;
  active: number;
  queued: number;
  maxConcurrentRequests: number;
  maxConcurrentPerPartition: number;
  maxQueueDepth: number;
  maxQueueDepthPerPartition: number;
  partitions: Array<{
    partitionKey: string;
    tenantId: string | null;
    userId: string | null;
    clientIp: string | null;
    active: number;
    queued: number;
    grantedCount: number;
    lastGrantedAt: string | null;
  }>;
};

type AcquireQueueResult =
  | { status: 'granted'; partitionKey: string }
  | {
      status: 'queued';
      partitionKey: string;
      routeQueueDepth: number;
      partitionQueueDepth: number;
    }
  | {
      status: 'rejected';
      partitionKey: string;
      routeQueueDepth: number;
      partitionQueueDepth: number;
      maxQueueDepth: number;
      maxQueueDepthPerPartition: number;
    };

type GrantWaiterResult =
  | { status: 'granted'; partitionKey: string }
  | { status: 'waiting' }
  | { status: 'missing' };

const DISTRIBUTED_QUEUE_ROUTES_KEY = 'operational-request-queue:routes';
const DISTRIBUTED_QUEUE_STATE_PREFIX = 'operational-request-queue:state:';
const DISTRIBUTED_LOAD_SHEDDING_GRANULAR_PREFIX = 'operational-load-shedding:granular:';
const DISTRIBUTED_QUEUE_STATE_TTL_MS = 5 * 60 * 1000;
const DISTRIBUTED_QUEUE_POLL_MS = 125;
const DISTRIBUTED_QUEUE_SNAPSHOT_REFRESH_MS = 1_000;
const DISTRIBUTED_GRANULAR_PRESSURE_TTL_MS = 60_000;

@Injectable()
export class OperationalRequestQueueService implements OnModuleDestroy {
  private latestSnapshot: OperationalRequestQueueSnapshot = {
    totalActive: 0,
    totalQueued: 0,
    routes: [],
  };
  private readonly snapshotRefreshTimer: NodeJS.Timeout;

  constructor(
    private readonly operationalObservabilityService: OperationalObservabilityService,
    private readonly distributedOperationalStateService: DistributedOperationalStateService,
  ) {
    this.snapshotRefreshTimer = setInterval(() => {
      void this.refreshSnapshot();
    }, DISTRIBUTED_QUEUE_SNAPSHOT_REFRESH_MS);
    this.snapshotRefreshTimer.unref?.();
    void this.refreshSnapshot();
  }

  onModuleDestroy(): void {
    clearInterval(this.snapshotRefreshTimer);
  }

  async run<T>(options: QueueOptions, action: () => Promise<T>): Promise<T> {
    if (!options.runtime.queueIsolationRequired) {
      return action();
    }

    const release = await this.acquire(options);
    try {
      return await action();
    } finally {
      await release();
    }
  }

  getSnapshot(): OperationalRequestQueueSnapshot {
    return {
      totalActive: this.latestSnapshot.totalActive,
      totalQueued: this.latestSnapshot.totalQueued,
      routes: this.latestSnapshot.routes.map((entry) => ({ ...entry })),
    };
  }

  async getRouteDebugState(
    routePolicyId: string,
  ): Promise<OperationalRequestQueueRouteDebugState | null> {
    const state = await this.distributedOperationalStateService.readJson<SharedQueueState>(
      this.getStateKey(routePolicyId),
    );

    if (!state) {
      return null;
    }

    const partitions = Object.entries(state.partitions || {})
      .map(([partitionKey, partition]) => ({
        partitionKey,
        tenantId: partition.tenantId,
        userId: partition.userId,
        clientIp: partition.clientIp,
        active: Number(partition.active || 0),
        queued: Array.isArray(partition.queue) ? partition.queue.length : 0,
        grantedCount: Number(partition.grantedCount || 0),
        lastGrantedAt: partition.lastGrantedAt
          ? new Date(partition.lastGrantedAt).toISOString()
          : null,
      }))
      .sort(
        (left, right) =>
          right.queued - left.queued ||
          right.active - left.active ||
          right.grantedCount - left.grantedCount ||
          left.partitionKey.localeCompare(right.partitionKey),
      );

    return {
      routePolicyId,
      active: Number(state.active || 0),
      queued: partitions.reduce((sum, partition) => sum + partition.queued, 0),
      maxConcurrentRequests: Number(state.maxConcurrentRequests || 0),
      maxConcurrentPerPartition: Number(state.maxConcurrentPerPartition || 0),
      maxQueueDepth: Number(state.maxQueueDepth || 0),
      maxQueueDepthPerPartition: Number(state.maxQueueDepthPerPartition || 0),
      partitions,
    };
  }

  private async acquire(options: QueueOptions): Promise<() => Promise<void>> {
    const stateKey = this.getStateKey(options.routePolicyId);
    const identity = this.resolvePartitionIdentity(
      options.request,
      options.runtime.fairQueueScope,
    );
    const maxQueueWaitMs = Math.max(1_000, options.runtime.maxQueueWaitMs || 15_000);
    const waiter: SharedQueueWaiter = {
      id: randomUUID(),
      enqueuedAt: Date.now(),
      expiresAt: Date.now() + maxQueueWaitMs,
      route: options.route,
      routePolicyId: options.routePolicyId,
      partitionKey: identity.partitionKey,
      tenantId: identity.tenantId,
      userId: identity.userId,
      clientIp: identity.clientIp,
    };

    const acquireResult = await this.distributedOperationalStateService.mutateJson<
      SharedQueueState,
      AcquireQueueResult
    >(
      stateKey,
      {
        seed: this.createEmptyQueueState(),
        ttlMs: DISTRIBUTED_QUEUE_STATE_TTL_MS,
      },
      (state) => {
        const now = Date.now();
        this.applyRuntimeLimits(state, options.runtime);
        this.pruneExpiredWaiters(state, now);
        const partition = this.getOrCreatePartitionState(state, identity);
        const routeQueuedDepth = this.getTotalQueued(state);
        const shouldGrantImmediately =
          routeQueuedDepth === 0 &&
          state.active < state.maxConcurrentRequests &&
          partition.active < state.maxConcurrentPerPartition;

        if (shouldGrantImmediately) {
          state.active += 1;
          partition.active += 1;
          partition.grantedCount += 1;
          partition.lastGrantedAt = now;
          return {
            next: this.normalizeQueueState(state),
            result: {
              status: 'granted',
              partitionKey: partition.key,
            },
          };
        }

        if (
          routeQueuedDepth >= state.maxQueueDepth ||
          partition.queue.length >= state.maxQueueDepthPerPartition
        ) {
          return {
            next: this.normalizeQueueState(state),
            result: {
              status: 'rejected',
              partitionKey: partition.key,
              routeQueueDepth: routeQueuedDepth,
              partitionQueueDepth: partition.queue.length,
              maxQueueDepth: state.maxQueueDepth,
              maxQueueDepthPerPartition: state.maxQueueDepthPerPartition,
            },
          };
        }

        if (!partition.queue.some((entry) => entry.id === waiter.id)) {
          partition.queue.push(waiter);
        }

        return {
          next: this.normalizeQueueState(state),
          result: {
            status: 'queued',
            partitionKey: partition.key,
            routeQueueDepth: this.getTotalQueued(state),
            partitionQueueDepth: partition.queue.length,
          },
        };
      },
    );

    await this.trackRouteState(options.routePolicyId);

    if (acquireResult.status === 'granted') {
      void this.refreshSnapshot();
      return this.createRelease(options.routePolicyId, acquireResult.partitionKey);
    }

    if (acquireResult.status === 'rejected') {
      this.operationalObservabilityService.record({
        type: 'request_queue_rejected',
        route: options.route,
        request: options.request,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        severity: 'warn',
        detail: `queue full route=${options.routePolicyId} partition=${acquireResult.partitionKey} routeDepth=${acquireResult.routeQueueDepth} partitionDepth=${acquireResult.partitionQueueDepth}`,
        extra: {
          routeId: options.routePolicyId,
          partitionKey: acquireResult.partitionKey,
          routeQueueDepth: acquireResult.routeQueueDepth,
          partitionQueueDepth: acquireResult.partitionQueueDepth,
          maxQueueDepth: acquireResult.maxQueueDepth,
          maxQueueDepthPerPartition: acquireResult.maxQueueDepthPerPartition,
          tenantId: waiter.tenantId,
          userId: waiter.userId,
          distributed: this.distributedOperationalStateService.isDistributedReady(),
        },
      });
      await this.recordGranularQueuePressure(
        options.routePolicyId,
        waiter.tenantId,
        'queue_rejected',
        3,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'REQUEST_QUEUE_FULL',
          message:
            'A fila desta operacao pesada atingiu o limite de isolamento para a particao atual. Tente novamente em instantes.',
          routePolicyId: options.routePolicyId,
          partitionKey: acquireResult.partitionKey,
          routeQueueDepth: acquireResult.routeQueueDepth,
          partitionQueueDepth: acquireResult.partitionQueueDepth,
          maxQueueDepth: acquireResult.maxQueueDepth,
          maxQueueDepthPerPartition: acquireResult.maxQueueDepthPerPartition,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.operationalObservabilityService.record({
      type: 'request_queued',
      route: options.route,
      request: options.request,
      severity: 'log',
      detail: `queued route=${options.routePolicyId} partition=${acquireResult.partitionKey} routeDepth=${acquireResult.routeQueueDepth} partitionDepth=${acquireResult.partitionQueueDepth}`,
      extra: {
        routeId: options.routePolicyId,
        partitionKey: acquireResult.partitionKey,
        routeQueueDepth: acquireResult.routeQueueDepth,
        partitionQueueDepth: acquireResult.partitionQueueDepth,
        maxQueueDepth: options.runtime.maxQueueDepth,
        maxQueueDepthPerPartition: options.runtime.maxQueueDepthPerPartition,
        tenantId: waiter.tenantId,
        userId: waiter.userId,
        distributed: this.distributedOperationalStateService.isDistributedReady(),
      },
    });
    void this.refreshSnapshot();

    const deadline = Date.now() + maxQueueWaitMs;
    while (Date.now() < deadline) {
      const grantResult = await this.distributedOperationalStateService.mutateJson<
        SharedQueueState,
        GrantWaiterResult
      >(
        stateKey,
        {
          seed: this.createEmptyQueueState(),
          ttlMs: DISTRIBUTED_QUEUE_STATE_TTL_MS,
        },
        (state) => {
          const now = Date.now();
          this.applyRuntimeLimits(state, options.runtime);
          this.pruneExpiredWaiters(state, now);
          const partition = state.partitions[waiter.partitionKey];
          const waiterExists = Boolean(
            partition?.queue.some((entry) => entry.id === waiter.id),
          );

          if (!waiterExists) {
            return {
              next: this.normalizeQueueState(state),
              result: {
                status: 'missing',
              },
            };
          }

          if (state.active >= state.maxConcurrentRequests) {
            return {
              next: this.normalizeQueueState(state),
              result: {
                status: 'waiting',
              },
            };
          }

          const candidate = this.selectNextPartition(state);
          if (!candidate) {
            return {
              next: this.normalizeQueueState(state),
              result: {
                status: 'waiting',
              },
            };
          }

          const nextWaiter = candidate.queue[0];
          if (!nextWaiter || nextWaiter.id !== waiter.id) {
            return {
              next: this.normalizeQueueState(state),
              result: {
                status: 'waiting',
              },
            };
          }

          candidate.queue.shift();
          state.active += 1;
          candidate.active += 1;
          candidate.grantedCount += 1;
          candidate.lastGrantedAt = now;

          return {
            next: this.normalizeQueueState(state),
            result: {
              status: 'granted',
              partitionKey: candidate.key,
            },
          };
        },
      );

      if (grantResult.status === 'granted') {
        void this.refreshSnapshot();
        return this.createRelease(options.routePolicyId, grantResult.partitionKey);
      }

      if (grantResult.status === 'missing') {
        break;
      }

      await this.sleep(DISTRIBUTED_QUEUE_POLL_MS);
    }

    await this.distributedOperationalStateService.mutateJson<SharedQueueState, void>(
      stateKey,
      {
        seed: this.createEmptyQueueState(),
        ttlMs: DISTRIBUTED_QUEUE_STATE_TTL_MS,
      },
      (state) => {
        this.pruneExpiredWaiters(state, Date.now());
        const partition = state.partitions[waiter.partitionKey];
        if (partition) {
          partition.queue = partition.queue.filter((entry) => entry.id !== waiter.id);
        }
        return {
          next: this.normalizeQueueState(state),
          result: undefined,
        };
      },
    );
    await this.cleanupRouteStateIfIdle(options.routePolicyId);
    void this.refreshSnapshot();

    this.operationalObservabilityService.record({
      type: 'request_queue_timeout',
      route: options.route,
      request: options.request,
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      severity: 'warn',
      detail: `queue wait timeout route=${options.routePolicyId} partition=${waiter.partitionKey} waitMs=${maxQueueWaitMs}`,
      extra: {
        routeId: options.routePolicyId,
        partitionKey: waiter.partitionKey,
        maxQueueWaitMs,
        tenantId: waiter.tenantId,
        userId: waiter.userId,
        distributed: this.distributedOperationalStateService.isDistributedReady(),
      },
    });
    await this.recordGranularQueuePressure(
      options.routePolicyId,
      waiter.tenantId,
      'queue_timeout',
      2,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'REQUEST_QUEUE_TIMEOUT',
        message:
          'A operacao aguardou tempo demais na fila de isolamento. O backend preservou a estabilidade e recusou a execucao tardia.',
        routePolicyId: options.routePolicyId,
        partitionKey: waiter.partitionKey,
        maxQueueWaitMs,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private createRelease(routePolicyId: string, partitionKey: string): () => Promise<void> {
    let released = false;
    return async () => {
      if (released) {
        return;
      }
      released = true;

      await this.distributedOperationalStateService.mutateJson<SharedQueueState, void>(
        this.getStateKey(routePolicyId),
        {
          seed: this.createEmptyQueueState(),
          ttlMs: DISTRIBUTED_QUEUE_STATE_TTL_MS,
        },
        (state) => {
          const partition = state.partitions[partitionKey];
          state.active = Math.max(0, state.active - 1);
          if (partition) {
            partition.active = Math.max(0, partition.active - 1);
          }

          return {
            next: this.normalizeQueueState(state),
            result: undefined,
          };
        },
      );
      await this.cleanupRouteStateIfIdle(routePolicyId);
      void this.refreshSnapshot();
    };
  }

  private async refreshSnapshot() {
    const routeIds = await this.distributedOperationalStateService.listSetMembers(
      DISTRIBUTED_QUEUE_ROUTES_KEY,
    );
    if (routeIds.length === 0) {
      this.latestSnapshot = {
        totalActive: 0,
        totalQueued: 0,
        routes: [],
      };
      return;
    }

    const routeStates = await this.distributedOperationalStateService.readJsonBatch<SharedQueueState>(
      routeIds.map((routeId) => this.getStateKey(routeId)),
    );

    const routes = routeStates
      .map(({ key, value }) => {
        const routePolicyId = key.replace(DISTRIBUTED_QUEUE_STATE_PREFIX, '');
        const state = value;
        if (!state) {
          return null;
        }

        const partitions = Object.values(state.partitions || {});
        const queued = partitions.reduce((sum, partition) => sum + partition.queue.length, 0);
        const active = Number(state.active || 0);
        const activePartitions = partitions.filter(
          (partition) => partition.active > 0 || partition.queue.length > 0,
        ).length;

        if (active === 0 && queued === 0) {
          void this.distributedOperationalStateService.removeSetMember(
            DISTRIBUTED_QUEUE_ROUTES_KEY,
            routePolicyId,
          );
          return null;
        }

        return {
          routePolicyId,
          active,
          queued,
          partitions: activePartitions,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.queued - left.queued || right.active - left.active)
      .slice(0, 10);

    this.latestSnapshot = {
      totalActive: routes.reduce((sum, route) => sum + route.active, 0),
      totalQueued: routes.reduce((sum, route) => sum + route.queued, 0),
      routes,
    };
  }

  private async trackRouteState(routePolicyId: string) {
    await this.distributedOperationalStateService.addSetMember(
      DISTRIBUTED_QUEUE_ROUTES_KEY,
      routePolicyId,
    );
  }

  private async cleanupRouteStateIfIdle(routePolicyId: string) {
    const state = await this.distributedOperationalStateService.readJson<SharedQueueState>(
      this.getStateKey(routePolicyId),
    );
    if (!state) {
      await this.distributedOperationalStateService.removeSetMember(
        DISTRIBUTED_QUEUE_ROUTES_KEY,
        routePolicyId,
      );
      return;
    }

    const totalQueued = this.getTotalQueued(state);
    if (state.active === 0 && totalQueued === 0) {
      await Promise.all([
        this.distributedOperationalStateService.deleteKey(this.getStateKey(routePolicyId)),
        this.distributedOperationalStateService.removeSetMember(
          DISTRIBUTED_QUEUE_ROUTES_KEY,
          routePolicyId,
        ),
      ]);
    }
  }

  private getStateKey(routePolicyId: string) {
    return `${DISTRIBUTED_QUEUE_STATE_PREFIX}${routePolicyId}`;
  }

  private createEmptyQueueState(): SharedQueueState {
    return {
      active: 0,
      partitions: {},
      maxConcurrentRequests: 1,
      maxConcurrentPerPartition: 1,
      maxQueueDepth: 0,
      maxQueueDepthPerPartition: 1,
    };
  }

  private applyRuntimeLimits(
    state: SharedQueueState,
    runtime: RouteRuntimeProtectionPolicy,
  ) {
    state.maxConcurrentRequests = Math.max(1, runtime.maxConcurrentRequests || 1);
    state.maxConcurrentPerPartition = Math.max(
      1,
      Math.min(
        state.maxConcurrentRequests,
        runtime.maxConcurrentPerPartition || 1,
      ),
    );
    state.maxQueueDepth = Math.max(0, runtime.maxQueueDepth || 0);
    state.maxQueueDepthPerPartition = Math.max(
      1,
      Math.min(
        Math.max(state.maxQueueDepth, 1),
        runtime.maxQueueDepthPerPartition || 1,
      ),
    );
  }

  private normalizeQueueState(state: SharedQueueState): SharedQueueState | null {
    for (const [partitionKey, partition] of Object.entries(state.partitions)) {
      if (partition.active === 0 && partition.queue.length === 0) {
        delete state.partitions[partitionKey];
      }
    }

    if (state.active === 0 && Object.keys(state.partitions).length === 0) {
      return null;
    }

    return state;
  }

  private pruneExpiredWaiters(state: SharedQueueState, now: number) {
    for (const partition of Object.values(state.partitions)) {
      partition.queue = partition.queue.filter((waiter) => waiter.expiresAt > now);
    }
  }

  private getOrCreatePartitionState(
    state: SharedQueueState,
    identity: QueuePartitionIdentity,
  ): SharedQueuePartitionState {
    const existing = state.partitions[identity.partitionKey];
    if (existing) {
      return existing;
    }

    const nextState: SharedQueuePartitionState = {
      key: identity.partitionKey,
      tenantId: identity.tenantId,
      userId: identity.userId,
      clientIp: identity.clientIp,
      active: 0,
      grantedCount: 0,
      lastGrantedAt: null,
      queue: [],
    };
    state.partitions[identity.partitionKey] = nextState;
    return nextState;
  }

  private getTotalQueued(state: SharedQueueState): number {
    return Object.values(state.partitions).reduce(
      (sum, partition) => sum + partition.queue.length,
      0,
    );
  }

  private selectNextPartition(state: SharedQueueState): SharedQueuePartitionState | null {
    const eligiblePartitions = Object.values(state.partitions).filter(
      (partition) =>
        partition.queue.length > 0 && partition.active < state.maxConcurrentPerPartition,
    );

    if (eligiblePartitions.length === 0) {
      return null;
    }

    eligiblePartitions.sort((left, right) => {
      if (left.grantedCount !== right.grantedCount) {
        return left.grantedCount - right.grantedCount;
      }

      const leftOldest = left.queue[0]?.enqueuedAt || Number.MAX_SAFE_INTEGER;
      const rightOldest = right.queue[0]?.enqueuedAt || Number.MAX_SAFE_INTEGER;
      if (leftOldest !== rightOldest) {
        return leftOldest - rightOldest;
      }

      const leftLastGranted = left.lastGrantedAt || 0;
      const rightLastGranted = right.lastGrantedAt || 0;
      if (leftLastGranted !== rightLastGranted) {
        return leftLastGranted - rightLastGranted;
      }

      return left.key.localeCompare(right.key);
    });

    return eligiblePartitions[0] || null;
  }

  private resolvePartitionIdentity(
    request: Record<string, any> | undefined,
    fairQueueScope: FairQueueScope,
  ): QueuePartitionIdentity {
    const tenantId = this.normalizeText(
      request?.user?.tenantId || request?.tenantId || request?.headers?.['x-tenant-id'],
    );
    const userId = this.normalizeText(request?.user?.id || request?.user?.sub);
    const clientIp = this.resolveClientIp(request);

    if (fairQueueScope === 'global') {
      return {
        partitionKey: 'global',
        tenantId,
        userId,
        clientIp,
      };
    }

    if (fairQueueScope === 'tenant-user' && tenantId && userId) {
      return {
        partitionKey: `tenant:${tenantId}:user:${userId}`,
        tenantId,
        userId,
        clientIp,
      };
    }

    if (fairQueueScope === 'user' && userId) {
      return {
        partitionKey: `user:${userId}`,
        tenantId,
        userId,
        clientIp,
      };
    }

    if (tenantId) {
      return {
        partitionKey: `tenant:${tenantId}`,
        tenantId,
        userId,
        clientIp,
      };
    }

    if (userId) {
      return {
        partitionKey: `user:${userId}`,
        tenantId,
        userId,
        clientIp,
      };
    }

    if (clientIp) {
      return {
        partitionKey: `ip:${clientIp}`,
        tenantId,
        userId,
        clientIp,
      };
    }

    return {
      partitionKey: 'global',
      tenantId,
      userId,
      clientIp,
    };
  }

  private resolveClientIp(request?: Record<string, any>): string | null {
    const directIp = this.normalizeText(request?.ip);
    if (directIp) {
      return directIp;
    }

    const forwardedForHeader = request?.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim().toLowerCase();
    }

    const realIpHeader = request?.headers?.['x-real-ip'];
    const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
      return realIp.trim().toLowerCase();
    }

    return null;
  }

  private normalizeText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async recordGranularQueuePressure(
    routePolicyId: string,
    tenantId: string | null,
    signal: 'queue_rejected' | 'queue_timeout',
    weight: number,
  ) {
    const normalizedTenantId = tenantId || 'anonymous';
    const key = `${DISTRIBUTED_LOAD_SHEDDING_GRANULAR_PREFIX}${routePolicyId}:${normalizedTenantId}`;

    await this.distributedOperationalStateService.mutateJson<
      {
        routePolicyId: string;
        tenantId: string | null;
        updatedAt: number;
        signalScore: number;
        rateLimitEvents: number;
        queueRejectedEvents: number;
        queueTimeoutEvents: number;
        runtimePressureEvents: number;
        lastSignal: string;
      },
      void
    >(
      key,
      {
        seed: {
          routePolicyId,
          tenantId,
          updatedAt: 0,
          signalScore: 0,
          rateLimitEvents: 0,
          queueRejectedEvents: 0,
          queueTimeoutEvents: 0,
          runtimePressureEvents: 0,
          lastSignal: signal,
        },
        ttlMs: DISTRIBUTED_GRANULAR_PRESSURE_TTL_MS,
      },
      (state) => {
        state.updatedAt = Date.now();
        state.signalScore = Math.min(20, state.signalScore + Math.max(1, weight));
        state.lastSignal = signal;
        if (signal === 'queue_rejected') {
          state.queueRejectedEvents += 1;
        } else {
          state.queueTimeoutEvents += 1;
        }
        return {
          next: state,
          result: undefined,
        };
      },
    );
  }
}
