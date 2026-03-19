import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

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
const DEFAULT_REDIS_CONNECT_TIMEOUT_MS = 1_500;
const MEMORY_LOCK_POLL_MS = 10;

@Injectable()
export class DistributedOperationalStateService implements OnModuleInit, OnModuleDestroy {
  private static readonly memoryJsonState = new Map<string, MemoryValueEntry>();
  private static readonly memorySets = new Map<string, Set<string>>();
  private static readonly memoryLocks = new Map<string, { ownerId: string; expiresAt: number }>();

  private readonly logger = new Logger(DistributedOperationalStateService.name);
  private readonly redisEnabled: boolean;
  private redis?: Redis;
  private fallbackActive = false;

  constructor() {
    this.redisEnabled = String(process.env.REDIS_HOST || '').trim().length > 0;
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.warn(
        'DistributedOperationalStateService: REDIS_HOST nao configurado. Coordenacao distribuida operara em memoria local.',
      );
      return;
    }

    const host = String(process.env.REDIS_HOST || '127.0.0.1').trim();
    const port = Number.parseInt(String(process.env.REDIS_PORT || '6379'), 10);
    const password = String(process.env.REDIS_PASSWORD || '').trim();
    const username = String(process.env.REDIS_USERNAME || '').trim();
    const db = Number.parseInt(String(process.env.REDIS_DB || '0'), 10);

    this.redis = new Redis({
      host,
      port: Number.isFinite(port) ? port : 6379,
      username: username || undefined,
      password: password || undefined,
      db: Number.isFinite(db) ? db : 0,
      connectTimeout: DEFAULT_REDIS_CONNECT_TIMEOUT_MS,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (error) => {
      if (!this.fallbackActive) {
        this.logger.error(
          `Erro no store operacional distribuido: ${error.message}. Fallback local ativado.`,
        );
        this.fallbackActive = true;
      }
    });

    this.redis.on('ready', () => {
      if (this.fallbackActive) {
        this.logger.log('Store operacional distribuido reconectado.');
        this.fallbackActive = false;
      }
    });

    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.error(`Falha ao conectar ao store operacional distribuido: ${String(error)}`);
      this.fallbackActive = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  isDistributedReady(): boolean {
    return Boolean(this.redis && !this.fallbackActive && this.redis.status === 'ready');
  }

  async readJson<T>(key: string): Promise<T | null> {
    if (this.isDistributedReady()) {
      try {
        const raw = await this.redis!.get(key);
        return this.deserialize<T>(raw);
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
          value: this.deserialize<T>(values[index]),
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
    if (this.isDistributedReady()) {
      try {
        const serialized = JSON.stringify(value);
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
        const mutation = await mutator(current);
        const ttlMs = mutation.ttlMs ?? options.ttlMs;

        if (mutation.next === null) {
          await this.deleteKey(key);
        } else {
          await this.writeJson(key, mutation.next, ttlMs);
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

    return this.deserialize<T>(entry.value);
  }

  private writeJsonToMemory<T>(key: string, value: T, ttlMs?: number) {
    DistributedOperationalStateService.memoryJsonState.set(key, {
      value: JSON.stringify(value),
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

  private cloneState<T>(value: T): T {
    return this.deserialize<T>(JSON.stringify(value)) as T;
  }

  private markFallback(error: unknown) {
    if (!this.fallbackActive) {
      this.logger.warn(
        `Store operacional distribuido em fallback local. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.fallbackActive = true;
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
