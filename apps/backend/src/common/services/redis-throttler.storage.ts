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

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallbackStorage = new ThrottlerStorageService();
  private readonly redisPrefix: string;
  private readonly redisEnabled: boolean;
  private readonly redis?: Redis;

  constructor(options: RedisThrottlerStorageOptions = {}) {
    this.redisEnabled = options.enabled !== false;
    this.redisPrefix = options.keyPrefix || 'rate-limit';

    if (!this.redisEnabled) {
      this.logger.warn('Redis throttling desativado por configuração; usando storage local em memória.');
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
      this.logger.warn(`Falha no Redis de rate limit; fallback em memória ativo. detalhe=${error.message}`);
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

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
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

      return {
        totalHits,
        timeToExpire: this.toSeconds(timeToExpireMs),
        isBlocked,
        timeToBlockExpire: this.toSeconds(timeToBlockExpireMs),
      };
    } catch (error) {
      this.logger.warn(
        `Erro ao aplicar rate limit no Redis; usando storage local para esta requisição. detalhe=${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fallbackStorage.increment(key, ttl, limit, safeBlockDuration, throttlerName);
    }
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
