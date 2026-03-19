import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FairQueueScope, RouteRuntimeProtectionPolicy } from '@contracts/api-routes';
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

type QueueWaiter = {
  enqueuedAt: number;
  maxQueueWaitMs: number;
  grant: (release: () => void) => void;
  reject: (error: unknown) => void;
  request?: Record<string, any>;
  route: string;
  routePolicyId: string;
  partitionKey: string;
  tenantId: string | null;
  userId: string | null;
  clientIp: string | null;
  timeout: NodeJS.Timeout | null;
};

type QueuePartitionState = {
  key: string;
  tenantId: string | null;
  userId: string | null;
  clientIp: string | null;
  active: number;
  grantedCount: number;
  lastGrantedAt: number | null;
  queue: QueueWaiter[];
};

type QueueState = {
  active: number;
  partitions: Map<string, QueuePartitionState>;
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

@Injectable()
export class OperationalRequestQueueService {
  private readonly queues = new Map<string, QueueState>();

  constructor(
    private readonly operationalObservabilityService: OperationalObservabilityService,
  ) {}

  async run<T>(options: QueueOptions, action: () => Promise<T>): Promise<T> {
    if (!options.runtime.queueIsolationRequired) {
      return action();
    }

    const release = await this.acquire(options);
    try {
      return await action();
    } finally {
      release();
    }
  }

  getSnapshot(): OperationalRequestQueueSnapshot {
    const routes = [...this.queues.entries()]
      .map(([routePolicyId, state]) => ({
        routePolicyId,
        active: state.active,
        queued: this.getTotalQueued(state),
        partitions: [...state.partitions.values()].filter(
          (partition) => partition.active > 0 || partition.queue.length > 0,
        ).length,
      }))
      .filter((entry) => entry.active > 0 || entry.queued > 0)
      .sort((left, right) => right.queued - left.queued || right.active - left.active);

    return {
      totalActive: routes.reduce((sum, route) => sum + route.active, 0),
      totalQueued: routes.reduce((sum, route) => sum + route.queued, 0),
      routes: routes.slice(0, 10),
    };
  }

  private acquire(options: QueueOptions): Promise<() => void> {
    const state = this.getQueueState(options.routePolicyId);
    this.applyRuntimeLimits(state, options.runtime);

    const identity = this.resolvePartitionIdentity(
      options.request,
      options.runtime.fairQueueScope,
    );
    const partition = this.getPartitionState(state, identity);

    const routeQueuedDepth = this.getTotalQueued(state);
    const shouldGrantImmediately =
      routeQueuedDepth === 0 &&
      state.active < state.maxConcurrentRequests &&
      partition.active < state.maxConcurrentPerPartition;

    if (shouldGrantImmediately) {
      state.active += 1;
      partition.active += 1;
      partition.grantedCount += 1;
      partition.lastGrantedAt = Date.now();
      return Promise.resolve(this.createRelease(options.routePolicyId, partition.key));
    }

    if (
      routeQueuedDepth >= state.maxQueueDepth ||
      partition.queue.length >= state.maxQueueDepthPerPartition
    ) {
      this.operationalObservabilityService.record({
        type: 'request_queue_rejected',
        route: options.route,
        request: options.request,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        severity: 'warn',
        detail: `queue full route=${options.routePolicyId} partition=${partition.key} routeDepth=${routeQueuedDepth} partitionDepth=${partition.queue.length}`,
        extra: {
          routeId: options.routePolicyId,
          partitionKey: partition.key,
          routeQueueDepth: routeQueuedDepth,
          partitionQueueDepth: partition.queue.length,
          maxQueueDepth: state.maxQueueDepth,
          maxQueueDepthPerPartition: state.maxQueueDepthPerPartition,
          active: state.active,
          tenantId: partition.tenantId,
          userId: partition.userId,
        },
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'REQUEST_QUEUE_FULL',
          message:
            'A fila desta operacao pesada atingiu o limite de isolamento para a particao atual. Tente novamente em instantes.',
          routePolicyId: options.routePolicyId,
          partitionKey: partition.key,
          routeQueueDepth: routeQueuedDepth,
          partitionQueueDepth: partition.queue.length,
          maxQueueDepth: state.maxQueueDepth,
          maxQueueDepthPerPartition: state.maxQueueDepthPerPartition,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new Promise((resolve, reject) => {
      const waiter: QueueWaiter = {
        enqueuedAt: Date.now(),
        maxQueueWaitMs: Math.max(1_000, options.runtime.maxQueueWaitMs || 15_000),
        grant: resolve,
        reject,
        request: options.request,
        route: options.route,
        routePolicyId: options.routePolicyId,
        partitionKey: partition.key,
        tenantId: partition.tenantId,
        userId: partition.userId,
        clientIp: partition.clientIp,
        timeout: null,
      };

      waiter.timeout = setTimeout(() => {
        const queueState = this.getQueueState(options.routePolicyId);
        const queuePartition = queueState.partitions.get(waiter.partitionKey);
        if (queuePartition) {
          queuePartition.queue = queuePartition.queue.filter((entry) => entry !== waiter);
          this.cleanupPartitionIfIdle(queueState, queuePartition.key);
        }
        this.cleanupQueueIfIdle(options.routePolicyId, queueState);
        this.operationalObservabilityService.record({
          type: 'request_queue_timeout',
          route: options.route,
          request: options.request,
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          severity: 'warn',
          detail: `queue wait timeout route=${options.routePolicyId} partition=${waiter.partitionKey} waitMs=${waiter.maxQueueWaitMs}`,
          extra: {
            routeId: options.routePolicyId,
            partitionKey: waiter.partitionKey,
            maxQueueWaitMs: waiter.maxQueueWaitMs,
            tenantId: waiter.tenantId,
            userId: waiter.userId,
          },
        });
        reject(
          new HttpException(
            {
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              code: 'REQUEST_QUEUE_TIMEOUT',
              message:
                'A operacao aguardou tempo demais na fila de isolamento. O backend preservou a estabilidade e recusou a execucao tardia.',
              routePolicyId: options.routePolicyId,
              partitionKey: waiter.partitionKey,
              maxQueueWaitMs: waiter.maxQueueWaitMs,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );
      }, waiter.maxQueueWaitMs);

      partition.queue.push(waiter);
      this.operationalObservabilityService.record({
        type: 'request_queued',
        route: options.route,
        request: options.request,
        severity: 'log',
        detail: `queued route=${options.routePolicyId} partition=${partition.key} routeDepth=${this.getTotalQueued(state)} partitionDepth=${partition.queue.length}`,
        extra: {
          routeId: options.routePolicyId,
          partitionKey: partition.key,
          routeQueueDepth: this.getTotalQueued(state),
          partitionQueueDepth: partition.queue.length,
          maxQueueDepth: state.maxQueueDepth,
          maxQueueDepthPerPartition: state.maxQueueDepthPerPartition,
          active: state.active,
          tenantId: partition.tenantId,
          userId: partition.userId,
        },
      });
      this.flushQueue(options.routePolicyId, state);
    });
  }

  private createRelease(routePolicyId: string, partitionKey: string): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;

      const state = this.getQueueState(routePolicyId);
      const partition = state.partitions.get(partitionKey);
      state.active = Math.max(0, state.active - 1);
      if (partition) {
        partition.active = Math.max(0, partition.active - 1);
      }
      this.cleanupPartitionIfIdle(state, partitionKey);
      this.flushQueue(routePolicyId, state);
    };
  }

  private flushQueue(routePolicyId: string, state: QueueState) {
    while (state.active < state.maxConcurrentRequests) {
      const candidate = this.selectNextPartition(state);
      if (!candidate) {
        break;
      }

      const waiter = candidate.queue.shift();
      if (!waiter) {
        this.cleanupPartitionIfIdle(state, candidate.key);
        continue;
      }

      if (waiter.timeout) {
        clearTimeout(waiter.timeout);
      }

      state.active += 1;
      candidate.active += 1;
      candidate.grantedCount += 1;
      candidate.lastGrantedAt = Date.now();
      waiter.grant(this.createRelease(routePolicyId, candidate.key));
      this.cleanupPartitionIfIdle(state, candidate.key);
    }

    this.cleanupQueueIfIdle(routePolicyId, state);
  }

  private selectNextPartition(state: QueueState): QueuePartitionState | null {
    const eligiblePartitions = [...state.partitions.values()].filter(
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

  private applyRuntimeLimits(
    state: QueueState,
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

  private getQueueState(routePolicyId: string): QueueState {
    const existing = this.queues.get(routePolicyId);
    if (existing) {
      return existing;
    }

    const nextState: QueueState = {
      active: 0,
      partitions: new Map<string, QueuePartitionState>(),
      maxConcurrentRequests: 1,
      maxConcurrentPerPartition: 1,
      maxQueueDepth: 0,
      maxQueueDepthPerPartition: 1,
    };
    this.queues.set(routePolicyId, nextState);
    return nextState;
  }

  private getPartitionState(
    state: QueueState,
    identity: QueuePartitionIdentity,
  ): QueuePartitionState {
    const existing = state.partitions.get(identity.partitionKey);
    if (existing) {
      return existing;
    }

    const nextState: QueuePartitionState = {
      key: identity.partitionKey,
      tenantId: identity.tenantId,
      userId: identity.userId,
      clientIp: identity.clientIp,
      active: 0,
      grantedCount: 0,
      lastGrantedAt: null,
      queue: [],
    };
    state.partitions.set(identity.partitionKey, nextState);
    return nextState;
  }

  private cleanupQueueIfIdle(routePolicyId: string, state: QueueState) {
    if (state.active === 0 && this.getTotalQueued(state) === 0) {
      this.queues.delete(routePolicyId);
    }
  }

  private cleanupPartitionIfIdle(state: QueueState, partitionKey: string) {
    const partition = state.partitions.get(partitionKey);
    if (!partition) {
      return;
    }

    if (partition.active === 0 && partition.queue.length === 0) {
      state.partitions.delete(partitionKey);
    }
  }

  private getTotalQueued(state: QueueState): number {
    return [...state.partitions.values()].reduce(
      (sum, partition) => sum + partition.queue.length,
      0,
    );
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
}
