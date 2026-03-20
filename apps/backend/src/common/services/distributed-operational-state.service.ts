import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  buildRedisHealthSnapshot,
  connectRedisClient,
  createRedisClientFromTopology,
  describeRedisTopology,
  getRedisClientStatus,
  isRedisClientReady,
  type RedisClientLike,
  type RedisHealthSnapshot,
  type RedisTopologyConfig,
  resolveRedisTopologyConfig,
  quitRedisClient,
} from './redis-topology.util';

const REDIS_RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`;

type MemoryValueEntry = {
  value: string;
  expiresAt: number | null;
};

type DistributedStateEnvelope<TValue> = {
  version: number;
  updatedAt: number;
  writerId: string;
  value: TValue;
};

type MutateJsonOptions<TState> = {
  seed: TState;
  ttlMs?: number;
  lockTtlMs?: number;
  waitTimeoutMs?: number;
};

type MutateJsonResult<TState, TResult> = {
  next: TState | null;
  result: TResult;
  ttlMs?: number;
};

const DEFAULT_LOCK_TTL_MS = 2_000;
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2_500;
const MEMORY_LOCK_POLL_MS = 10;

@Injectable()
export class DistributedOperationalStateService implements OnModuleInit, OnModuleDestroy {
  private static readonly memoryJsonState = new Map<string, MemoryValueEntry>();
  private static readonly memorySets = new Map<string, Set<string>>();
  private static readonly memoryLocks = new Map<string, { ownerId: string; expiresAt: number }>();

  private readonly logger = new Logger(DistributedOperationalStateService.name);
  private readonly topologyConfig: RedisTopologyConfig;
  private readonly instanceId =
    process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || `instance-${process.pid}`;
  private redis?: RedisClientLike;
  private fallbackActive = false;
  private lastFallbackDetail: string | null = null;

  constructor() {
    this.topologyConfig = resolveRedisTopologyConfig(process.env, {
      fallbackModeEnvKey: 'DISTRIBUTED_STATE_FALLBACK_MODE',
      requiredEnvKey: 'DISTRIBUTED_STATE_REQUIRED',
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.topologyConfig.enabled) {
      this.logger.warn(
        'DistributedOperationalStateService: Redis distribuido nao configurado. Coordenacao operara em fallback local explicito.',
      );
      return;
    }

    this.redis = createRedisClientFromTopology(this.topologyConfig);
    if (!this.redis) {
      this.logger.warn(
        `DistributedOperationalStateService: topologia Redis invalida para ${describeRedisTopology(this.topologyConfig)}. Fallback local explicito ativo.`,
      );
      this.fallbackActive = true;
      this.lastFallbackDetail = 'redis-topology-invalid';
      return;
    }

    this.redis.on('error', (error) => {
      this.markFallback(error);
    });

    this.redis.on('ready', () => {
      if (this.fallbackActive) {
        this.logger.log(
          `Store operacional distribuido reconectado via ${describeRedisTopology(this.topologyConfig)}.`,
        );
        this.fallbackActive = false;
        this.lastFallbackDetail = null;
      }
    });

    try {
      await connectRedisClient(this.redis);
    } catch (error) {
      this.markFallback(error);
      if (this.topologyConfig.required && this.topologyConfig.fallbackMode === 'strict') {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await quitRedisClient(this.redis);
  }

  isDistributedReady(): boolean {
    return Boolean(this.redis && !this.fallbackActive && isRedisClientReady(this.redis));
  }

  isFallbackActive(): boolean {
    return this.fallbackActive || !this.isDistributedReady();
  }

  getHealth(): RedisHealthSnapshot {
    return buildRedisHealthSnapshot({
      config: this.topologyConfig,
      client: this.redis,
      fallbackActive: this.isFallbackActive(),
      detail: this.lastFallbackDetail,
    });
  }

  async readJson<T>(key: string): Promise<T | null> {
    if (this.isDistributedReady()) {
      try {
        const raw = await this.redis!.get(key);
        return this.deserializeEnvelope<T>(raw)?.value || null;
      } catch (error) {
        this.markFallback(error);
      }
    }

    return this.readJsonFromMemory<T>(key);
  }

  async readJsonBatch<T>(keys: string[]): Promise<Array<{ key: string; value: T | null }>> {
    const normalizedKeys = [...new Set(keys.filter((key) => String(key || '').trim().length > 0))];
    if (normalizedKeys.length === 0) {
      return [];
    }

    if (this.isDistributedReady()) {
      try {
        const values = await this.redis!.mget(...normalizedKeys);
        return normalizedKeys.map((key, index) => ({
          key,
          value: this.deserializeEnvelope<T>(values[index])?.value || null,
        }));
      } catch (error) {
        this.markFallback(error);
      }
    }

    return normalizedKeys.map((key) => ({
      key,
      value: this.readJsonFromMemory<T>(key),
    }));
  }

  async writeJson<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const serialized = JSON.stringify(this.createEnvelope(value));
    if (this.isDistributedReady()) {
      try {
        if (ttlMs && ttlMs > 0) {
          await this.redis!.set(key, serialized, 'PX', Math.floor(ttlMs));
        } else {
          await this.redis!.set(key, serialized);
        }
        return;
      } catch (error) {
        this.markFallback(error);
      }
    }

    this.writeJsonToMemory(key, value, ttlMs);
  }

  async deleteKey(key: string): Promise<void> {
    if (this.isDistributedReady()) {
      try {
        await this.redis!.del(key);
        return;
      } catch (error) {
        this.markFallback(error);
      }
    }

    DistributedOperationalStateService.memoryJsonState.delete(key);
  }

  async addSetMember(setKey: string, member: string): Promise<void> {
    const normalizedMember = String(member || '').trim();
    if (!normalizedMember) {
      return;
    }

    if (this.isDistributedReady()) {
      try {
        await this.redis!.sadd(setKey, normalizedMember);
        return;
      } catch (error) {
        this.markFallback(error);
      }
    }

    const bucket =
      DistributedOperationalStateService.memorySets.get(setKey) || new Set<string>();
    bucket.add(normalizedMember);
    DistributedOperationalStateService.memorySets.set(setKey, bucket);
  }

  async removeSetMember(setKey: string, member: string): Promise<void> {
    const normalizedMember = String(member || '').trim();
    if (!normalizedMember) {
      return;
    }

    if (this.isDistributedReady()) {
      try {
        await this.redis!.srem(setKey, normalizedMember);
        return;
      } catch (error) {
        this.markFallback(error);
      }
    }

    const bucket = DistributedOperationalStateService.memorySets.get(setKey);
    if (!bucket) {
      return;
    }

    bucket.delete(normalizedMember);
    if (bucket.size === 0) {
      DistributedOperationalStateService.memorySets.delete(setKey);
    }
  }

  async listSetMembers(setKey: string): Promise<string[]> {
    if (this.isDistributedReady()) {
      try {
        return await this.redis!.smembers(setKey);
      } catch (error) {
        this.markFallback(error);
      }
    }

    return [...(DistributedOperationalStateService.memorySets.get(setKey) || new Set<string>())];
  }

  async mutateJson<TState, TResult>(
    key: string,
    options: MutateJsonOptions<TState>,
    mutator: (state: TState) => MutateJsonResult<TState, TResult> | Promise<MutateJsonResult<TState, TResult>>,
  ): Promise<TResult> {
    return this.withLock(
      `distributed-state:${key}`,
      async () => {
        const current = (await this.readJson<TState>(key)) || this.cloneState(options.seed);
        const currentEnvelope = await this.readEnvelope<TState>(key);
        const mutation = await mutator(current);
        const ttlMs = mutation.ttlMs ?? options.ttlMs;

        if (mutation.next === null) {
          await this.deleteKey(key);
        } else {
          await this.writeJsonEnvelope(
            key,
            mutation.next,
            ttlMs,
            (currentEnvelope?.version || 0) + 1,
          );
        }

        return mutation.result;
      },
      {
        lockTtlMs: options.lockTtlMs,
        waitTimeoutMs: options.waitTimeoutMs,
      },
    );
  }

  private async withLock<TResult>(
    lockKey: string,
    action: () => Promise<TResult>,
    options: {
      lockTtlMs?: number;
      waitTimeoutMs?: number;
    } = {},
  ): Promise<TResult> {
    const lockTtlMs = Math.max(250, options.lockTtlMs || DEFAULT_LOCK_TTL_MS);
    const waitTimeoutMs = Math.max(lockTtlMs, options.waitTimeoutMs || DEFAULT_LOCK_WAIT_TIMEOUT_MS);

    if (
      !this.isDistributedReady() &&
      this.topologyConfig.required &&
      this.topologyConfig.fallbackMode === 'strict'
    ) {
      throw new Error(`Distributed operational state unavailable for ${lockKey}`);
    }

    if (this.isDistributedReady()) {
      return this.withRedisLock(lockKey, action, lockTtlMs, waitTimeoutMs);
    }

    return this.withMemoryLock(lockKey, action, lockTtlMs, waitTimeoutMs);
  }

  private async withRedisLock<TResult>(
    lockKey: string,
    action: () => Promise<TResult>,
    lockTtlMs: number,
    waitTimeoutMs: number,
  ): Promise<TResult> {
    const ownerId = randomUUID();
    const startedAt = Date.now();

    while (Date.now() - startedAt < waitTimeoutMs) {
      try {
        const acquired = await this.redis!.set(lockKey, ownerId, 'PX', lockTtlMs, 'NX');
        if (acquired === 'OK') {
          try {
            return await action();
          } finally {
            try {
              await this.redis!.eval(REDIS_RELEASE_LOCK_SCRIPT, 1, lockKey, ownerId);
            } catch (error) {
              this.markFallback(error);
            }
          }
        }
      } catch (error) {
        this.markFallback(error);
        break;
      }

      await this.sleep(MEMORY_LOCK_POLL_MS);
    }

    return this.withMemoryLock(lockKey, action, lockTtlMs, waitTimeoutMs);
  }

  private async withMemoryLock<TResult>(
    lockKey: string,
    action: () => Promise<TResult>,
    lockTtlMs: number,
    waitTimeoutMs: number,
  ): Promise<TResult> {
    const ownerId = randomUUID();
    const startedAt = Date.now();

    while (Date.now() - startedAt < waitTimeoutMs) {
      const current = DistributedOperationalStateService.memoryLocks.get(lockKey);
      const now = Date.now();
      if (!current || current.expiresAt <= now) {
        DistributedOperationalStateService.memoryLocks.set(lockKey, {
          ownerId,
          expiresAt: now + lockTtlMs,
        });

        try {
          return await action();
        } finally {
          const latest = DistributedOperationalStateService.memoryLocks.get(lockKey);
          if (latest?.ownerId === ownerId) {
            DistributedOperationalStateService.memoryLocks.delete(lockKey);
          }
        }
      }

      await this.sleep(MEMORY_LOCK_POLL_MS);
    }

    throw new Error(`Timeout ao aguardar lock operacional ${lockKey}`);
  }

  private readJsonFromMemory<T>(key: string): T | null {
    const entry = DistributedOperationalStateService.memoryJsonState.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      DistributedOperationalStateService.memoryJsonState.delete(key);
      return null;
    }

    return this.deserializeEnvelope<T>(entry.value)?.value || null;
  }

  private writeJsonToMemory<T>(key: string, value: T, ttlMs?: number) {
    DistributedOperationalStateService.memoryJsonState.set(key, {
      value: JSON.stringify(this.createEnvelope(value)),
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    });
  }

  private deserialize<T>(raw: string | null | undefined): T | null {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private deserializeEnvelope<T>(raw: string | null | undefined): DistributedStateEnvelope<T> | null {
    const parsed = this.deserialize<DistributedStateEnvelope<T> | T>(raw);
    if (!parsed) {
      return null;
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.prototype.hasOwnProperty.call(parsed, 'value') &&
      Object.prototype.hasOwnProperty.call(parsed, 'version') &&
      Object.prototype.hasOwnProperty.call(parsed, 'updatedAt')
    ) {
      const envelope = parsed as DistributedStateEnvelope<T>;
      if (
        typeof envelope.version === 'number' &&
        Number.isFinite(envelope.version) &&
        typeof envelope.updatedAt === 'number' &&
        Number.isFinite(envelope.updatedAt)
      ) {
        return envelope;
      }
    }

    return {
      version: 1,
      updatedAt: Date.now(),
      writerId: 'legacy',
      value: parsed as T,
    };
  }

  private cloneState<T>(value: T): T {
    return this.deserialize<T>(JSON.stringify(value)) as T;
  }

  private createEnvelope<T>(
    value: T,
    version = 1,
  ): DistributedStateEnvelope<T> {
    return {
      version,
      updatedAt: Date.now(),
      writerId: this.instanceId,
      value,
    };
  }

  private async readEnvelope<T>(key: string): Promise<DistributedStateEnvelope<T> | null> {
    if (this.isDistributedReady()) {
      try {
        const raw = await this.redis!.get(key);
        return this.deserializeEnvelope<T>(raw);
      } catch (error) {
        this.markFallback(error);
      }
    }

    const entry = DistributedOperationalStateService.memoryJsonState.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      DistributedOperationalStateService.memoryJsonState.delete(key);
      return null;
    }

    return this.deserializeEnvelope<T>(entry.value);
  }

  private async writeJsonEnvelope<T>(
    key: string,
    value: T,
    ttlMs: number | undefined,
    version: number,
  ) {
    const serialized = JSON.stringify(this.createEnvelope(value, version));
    if (this.isDistributedReady()) {
      try {
        if (ttlMs && ttlMs > 0) {
          await this.redis!.set(key, serialized, 'PX', Math.floor(ttlMs));
        } else {
          await this.redis!.set(key, serialized);
        }
        return;
      } catch (error) {
        this.markFallback(error);
      }
    }

    DistributedOperationalStateService.memoryJsonState.set(key, {
      value: serialized,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    });
  }

  private markFallback(error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!this.fallbackActive || this.lastFallbackDetail !== detail) {
      this.logger.warn(
        `Store operacional distribuido em fallback local explicito. topology=${describeRedisTopology(this.topologyConfig)} status=${getRedisClientStatus(this.redis)} detalhe=${detail}`,
      );
    }
    this.fallbackActive = true;
    this.lastFallbackDetail = detail;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static resetForTests() {
    this.memoryJsonState.clear();
    this.memorySets.clear();
    this.memoryLocks.clear();
  }
}
