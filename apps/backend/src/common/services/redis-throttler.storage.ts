import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';

type RedisThrottlerStorageOptions = {
  enabled?: boolean;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  retryCooldownMs?: number;
};

const REDIS_INCREMENT_SCRIPT = `
local counterKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local count = tonumber(redis.call('GET', counterKey) or '0')
  local counterTtl = redis.call('PTTL', counterKey)
  if counterTtl < 0 then
    counterTtl = 0
  end
  return { count, counterTtl, 1, blockTtl }
end

local count = tonumber(redis.call('INCR', counterKey))
if count == 1 then
  redis.call('PEXPIRE', counterKey, ttl)
end

local counterTtl = redis.call('PTTL', counterKey)
if counterTtl < 0 then
  counterTtl = ttl
end

local isBlocked = 0
local blockRemaining = 0

if count > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  isBlocked = 1
  blockRemaining = blockDuration
end

return { count, counterTtl, isBlocked, blockRemaining }
`;

const REDIS_RETRY_COOLDOWN_MS = 15000;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallbackStorage = new ThrottlerStorageService();
  private readonly redisPrefix: string;
  private readonly redisEnabled: boolean;
  private readonly retryCooldownMs: number;
  private readonly redis?: Redis;
  private redisRetryAvailableAt = 0;
  private fallbackActive = false;
  private lastFallbackLogAt = 0;
  private lastFallbackDetail = '';

  constructor(options: RedisThrottlerStorageOptions = {}) {
    this.redisEnabled = options.enabled !== false;
    this.redisPrefix = options.keyPrefix || 'rate-limit';
    this.retryCooldownMs = options.retryCooldownMs ?? REDIS_RETRY_COOLDOWN_MS;

    if (!this.redisEnabled) {
      this.logger.warn('Redis throttling desativado por configuracao; usando storage local em memoria.');
      return;
    }

    const host = options.host || '127.0.0.1';
    const port = options.port || 6379;
    const db = options.db ?? 0;
    const connectTimeout = options.connectTimeout ?? 1000;

    this.redis = new Redis({
      host,
      port,
      username: options.username,
      password: options.password,
      db,
      connectTimeout,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (error) => {
      this.markRedisUnavailable(
        'Falha no Redis de rate limit; fallback em memoria ativo.',
        error.message,
      );
    });

    this.redis.on('ready', () => {
      this.markRedisRecovered();
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    if (!this.redis) {
      return this.fallbackStorage.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    const scopedCounterKey = `${this.redisPrefix}:${throttlerName}:counter:${key}`;
    const scopedBlockKey = `${this.redisPrefix}:${throttlerName}:block:${key}`;
    const safeBlockDuration = Number.isFinite(blockDuration) && blockDuration > 0 ? blockDuration : ttl;

    if (this.shouldUseFallbackWithoutRetry()) {
      return this.fallbackStorage.increment(key, ttl, limit, safeBlockDuration, throttlerName);
    }

    try {
      if (this.shouldAttemptReconnect()) {
        await this.redis.connect();
      }

      if (this.redis.status !== 'ready') {
        throw new Error(`Redis status ${this.redis.status}`);
      }

      const rawResult = await this.redis.eval(
        REDIS_INCREMENT_SCRIPT,
        2,
        scopedCounterKey,
        scopedBlockKey,
        String(ttl),
        String(limit),
        String(safeBlockDuration),
      );

      const [rawHits, rawTtlMs, rawBlocked, rawBlockTtlMs] = Array.isArray(rawResult) ? rawResult : [0, 0, 0, 0];

      const totalHits = this.parseRedisNumber(rawHits);
      const timeToExpireMs = this.parseRedisNumber(rawTtlMs);
      const isBlocked = this.parseRedisNumber(rawBlocked) === 1;
      const timeToBlockExpireMs = this.parseRedisNumber(rawBlockTtlMs);

      this.markRedisRecovered();

      return {
        totalHits,
        timeToExpire: this.toSeconds(timeToExpireMs),
        isBlocked,
        timeToBlockExpire: this.toSeconds(timeToBlockExpireMs),
      };
    } catch (error) {
      this.markRedisUnavailable(
        'Erro ao aplicar rate limit no Redis; usando storage local nesta janela.',
        error instanceof Error ? error.message : String(error),
      );
      return this.fallbackStorage.increment(key, ttl, limit, safeBlockDuration, throttlerName);
    }
  }

  private shouldUseFallbackWithoutRetry(): boolean {
    return !!this.redis && this.redis.status !== 'ready' && Date.now() < this.redisRetryAvailableAt;
  }

  private shouldAttemptReconnect(): boolean {
    return !!this.redis && ['wait', 'end', 'close'].includes(this.redis.status);
  }

  private markRedisUnavailable(prefix: string, detail: string): void {
    const now = Date.now();
    const shouldLog =
      !this.fallbackActive ||
      now - this.lastFallbackLogAt >= this.retryCooldownMs ||
      this.lastFallbackDetail !== detail;

    this.redisRetryAvailableAt = now + this.retryCooldownMs;
    this.fallbackActive = true;

    if (!shouldLog) {
      return;
    }

    this.lastFallbackLogAt = now;
    this.lastFallbackDetail = detail;
    this.logger.warn(
      `${prefix} novas tentativas em ${Math.ceil(this.retryCooldownMs / 1000)}s. detalhe=${detail}`,
    );
  }

  private markRedisRecovered(): void {
    if (this.fallbackActive) {
      this.logger.log('Redis de rate limit reconectado; storage distribuido reativado.');
    }

    this.fallbackActive = false;
    this.redisRetryAvailableAt = 0;
    this.lastFallbackDetail = '';
  }

  private parseRedisNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private toSeconds(milliseconds: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      return 0;
    }
    return Math.ceil(milliseconds / 1000);
  }
}
