import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export type RateLimitMetricInput = {
  tenantId?: string | null;
  scope: 'ip' | 'user' | 'tenant-user' | 'tenant' | 'api-key';
  path: string;
  blocked: boolean;
  timestamp?: Date;
};

export type RateLimitStatsParams = {
  hours?: number;
  tenantId?: string;
  top?: number;
};

type CounterPair = { hits: number; blocked: number };

type MemoryBucket = {
  counters: Map<string, number>;
  endpoints: Map<string, number>;
  blockedEndpoints: Map<string, number>;
  expiresAt: number;
};

@Injectable()
export class RateLimitMetricsService {
  private readonly logger = new Logger(RateLimitMetricsService.name);
  private readonly redisEnabled = process.env.RATE_LIMIT_REDIS_ENABLED !== 'false';
  private readonly redisPrefix = process.env.RATE_LIMIT_REDIS_PREFIX || 'rate-limit';
  private readonly retentionHours = this.readEnvNumber('RATE_LIMIT_METRICS_RETENTION_HOURS', 168);
  private readonly maxQueryHours = this.readEnvNumber('RATE_LIMIT_METRICS_MAX_QUERY_HOURS', 168);
  private readonly redis?: Redis;
  private readonly memoryBuckets = new Map<string, MemoryBucket>();

  constructor() {
    if (!this.redisEnabled) {
      this.logger.warn('Rate limit metrics em Redis desativadas; usando armazenamento local em memória.');
      return;
    }

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || 6379);
    const connectTimeout = this.readEnvNumber('RATE_LIMIT_REDIS_CONNECT_TIMEOUT', 1000);

    this.redis = new Redis({
      host,
      port,
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      connectTimeout,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (error) => {
      this.logger.warn(`Falha no Redis de métricas de rate limit; fallback em memória ativo. detalhe=${error.message}`);
    });
  }

  async record(input: RateLimitMetricInput): Promise<void> {
    const timestamp = input.timestamp || new Date();
    const bucket = this.getBucketKey(timestamp);
    const tenantId = this.normalizeTenant(input.tenantId);
    const path = this.normalizePath(input.path);
    const endpointMember = `${tenantId}|${path}`;

    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }

        const hashKey = `${this.redisPrefix}:metrics:h:${bucket}`;
        const endpointsKey = `${this.redisPrefix}:metrics:e:${bucket}`;
        const blockedEndpointsKey = `${this.redisPrefix}:metrics:eb:${bucket}`;
        const ttlSeconds = this.retentionHours * 3600;

        const pipeline = this.redis.multi();
        pipeline.hincrby(hashKey, 'hits', 1);
        if (input.blocked) {
          pipeline.hincrby(hashKey, 'blocked', 1);
        }
        pipeline.hincrby(hashKey, `tenant:${tenantId}:hits`, 1);
        if (input.blocked) {
          pipeline.hincrby(hashKey, `tenant:${tenantId}:blocked`, 1);
        }
        pipeline.hincrby(hashKey, `scope:${input.scope}:hits`, 1);
        if (input.blocked) {
          pipeline.hincrby(hashKey, `scope:${input.scope}:blocked`, 1);
        }
        pipeline.zincrby(endpointsKey, 1, endpointMember);
        if (input.blocked) {
          pipeline.zincrby(blockedEndpointsKey, 1, endpointMember);
        }
        pipeline.expire(hashKey, ttlSeconds);
        pipeline.expire(endpointsKey, ttlSeconds);
        pipeline.expire(blockedEndpointsKey, ttlSeconds);
        await pipeline.exec();
        return;
      } catch (error) {
        this.logger.warn(
          `Erro ao gravar métricas de rate limit no Redis; usando memória nesta requisição. detalhe=${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.recordInMemory(bucket, tenantId, input.scope, path, input.blocked);
  }

  async getStats(params: RateLimitStatsParams = {}) {
    const hours = this.clamp(params.hours ?? 24, 1, this.maxQueryHours);
    const top = this.clamp(params.top ?? 20, 1, 100);
    const tenantFilter = params.tenantId ? this.normalizeTenant(params.tenantId) : null;
    const buckets = this.listBuckets(hours);

    const totals: CounterPair = { hits: 0, blocked: 0 };
    const byTenant = new Map<string, CounterPair>();
    const byScope = new Map<string, CounterPair>();
    const endpointHits = new Map<string, number>();
    const endpointBlocked = new Map<string, number>();

    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }

        const multi = this.redis.multi();
        for (const bucket of buckets) {
          multi.hgetall(`${this.redisPrefix}:metrics:h:${bucket}`);
          multi.zrevrange(`${this.redisPrefix}:metrics:e:${bucket}`, 0, top * 3, 'WITHSCORES');
          multi.zrevrange(`${this.redisPrefix}:metrics:eb:${bucket}`, 0, top * 3, 'WITHSCORES');
        }

        const rawResults = await multi.exec();
        if (rawResults) {
          for (let i = 0; i < rawResults.length; i += 3) {
            const rawCounters = rawResults[i]?.[1];
            const rawEndpoints = rawResults[i + 1]?.[1];
            const rawBlockedEndpoints = rawResults[i + 2]?.[1];

            this.aggregateCounters(
              rawCounters as Record<string, string>,
              totals,
              byTenant,
              byScope,
              tenantFilter,
            );
            this.aggregateEndpointZset(rawEndpoints as string[], endpointHits, tenantFilter);
            this.aggregateEndpointZset(rawBlockedEndpoints as string[], endpointBlocked, tenantFilter);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Erro ao consultar métricas no Redis; usando agregação local em memória. detalhe=${error instanceof Error ? error.message : String(error)}`,
        );
        this.aggregateFromMemory(buckets, totals, byTenant, byScope, endpointHits, endpointBlocked, tenantFilter);
      }
    } else {
      this.aggregateFromMemory(buckets, totals, byTenant, byScope, endpointHits, endpointBlocked, tenantFilter);
    }

    const resolvedTotals = tenantFilter
      ? (byTenant.get(tenantFilter) || { hits: 0, blocked: 0 })
      : totals;

    return {
      windowHours: hours,
      totals: {
        hits: resolvedTotals.hits,
        blocked: resolvedTotals.blocked,
        blockRate: this.computeRate(resolvedTotals.blocked, resolvedTotals.hits),
      },
      byTenant: this.mapCounterMap(byTenant, tenantFilter),
      byScope: this.mapCounterMap(byScope, null),
      topEndpoints: this.mapEndpointMap(endpointHits, top),
      topBlockedEndpoints: this.mapEndpointMap(endpointBlocked, top),
    };
  }

  private aggregateFromMemory(
    buckets: string[],
    totals: CounterPair,
    byTenant: Map<string, CounterPair>,
    byScope: Map<string, CounterPair>,
    endpointHits: Map<string, number>,
    endpointBlocked: Map<string, number>,
    tenantFilter: string | null,
  ): void {
    const now = Date.now();
    for (const bucket of buckets) {
      const bucketStore = this.memoryBuckets.get(bucket);
      if (!bucketStore || bucketStore.expiresAt <= now) {
        continue;
      }

      const pseudoCounters: Record<string, string> = {};
      for (const [key, value] of bucketStore.counters.entries()) {
        pseudoCounters[key] = String(value);
      }

      this.aggregateCounters(pseudoCounters, totals, byTenant, byScope, tenantFilter);

      for (const [member, value] of bucketStore.endpoints.entries()) {
        if (tenantFilter && !member.startsWith(`${tenantFilter}|`)) {
          continue;
        }
        endpointHits.set(member, (endpointHits.get(member) || 0) + value);
      }
      for (const [member, value] of bucketStore.blockedEndpoints.entries()) {
        if (tenantFilter && !member.startsWith(`${tenantFilter}|`)) {
          continue;
        }
        endpointBlocked.set(member, (endpointBlocked.get(member) || 0) + value);
      }
    }
  }

  private aggregateCounters(
    counters: Record<string, string> | undefined,
    totals: CounterPair,
    byTenant: Map<string, CounterPair>,
    byScope: Map<string, CounterPair>,
    tenantFilter: string | null,
  ): void {
    if (!counters) {
      return;
    }

    totals.hits += this.parseNumber(counters.hits);
    totals.blocked += this.parseNumber(counters.blocked);

    for (const [key, valueText] of Object.entries(counters)) {
      const value = this.parseNumber(valueText);
      if (value <= 0) {
        continue;
      }

      const tenantHitMatch = key.match(/^tenant:(.+):hits$/);
      if (tenantHitMatch) {
        const tenantId = tenantHitMatch[1];
        this.bumpCounterMap(byTenant, tenantId, 'hits', value, tenantFilter);
        continue;
      }

      const tenantBlockedMatch = key.match(/^tenant:(.+):blocked$/);
      if (tenantBlockedMatch) {
        const tenantId = tenantBlockedMatch[1];
        this.bumpCounterMap(byTenant, tenantId, 'blocked', value, tenantFilter);
        continue;
      }

      const scopeHitMatch = key.match(/^scope:(.+):hits$/);
      if (scopeHitMatch) {
        this.bumpCounterMap(byScope, scopeHitMatch[1], 'hits', value, null);
        continue;
      }

      const scopeBlockedMatch = key.match(/^scope:(.+):blocked$/);
      if (scopeBlockedMatch) {
        this.bumpCounterMap(byScope, scopeBlockedMatch[1], 'blocked', value, null);
      }
    }
  }

  private aggregateEndpointZset(
    raw: string[] | undefined,
    target: Map<string, number>,
    tenantFilter: string | null,
  ): void {
    if (!Array.isArray(raw)) {
      return;
    }
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const score = this.parseNumber(raw[i + 1]);
      if (!member || score <= 0) {
        continue;
      }
      if (tenantFilter && !member.startsWith(`${tenantFilter}|`)) {
        continue;
      }
      target.set(member, (target.get(member) || 0) + score);
    }
  }

  private recordInMemory(
    bucket: string,
    tenantId: string,
    scope: RateLimitMetricInput['scope'],
    path: string,
    blocked: boolean,
  ): void {
    const retentionMs = this.retentionHours * 3600 * 1000;
    const expiresAt = Date.now() + retentionMs;
    const bucketStore = this.memoryBuckets.get(bucket) || {
      counters: new Map<string, number>(),
      endpoints: new Map<string, number>(),
      blockedEndpoints: new Map<string, number>(),
      expiresAt,
    };
    bucketStore.expiresAt = expiresAt;

    const endpointMember = `${tenantId}|${path}`;
    this.bumpMap(bucketStore.counters, 'hits', 1);
    this.bumpMap(bucketStore.counters, `tenant:${tenantId}:hits`, 1);
    this.bumpMap(bucketStore.counters, `scope:${scope}:hits`, 1);
    this.bumpMap(bucketStore.endpoints, endpointMember, 1);

    if (blocked) {
      this.bumpMap(bucketStore.counters, 'blocked', 1);
      this.bumpMap(bucketStore.counters, `tenant:${tenantId}:blocked`, 1);
      this.bumpMap(bucketStore.counters, `scope:${scope}:blocked`, 1);
      this.bumpMap(bucketStore.blockedEndpoints, endpointMember, 1);
    }

    this.memoryBuckets.set(bucket, bucketStore);
    this.pruneMemoryBuckets();
  }

  private bumpCounterMap(
    target: Map<string, CounterPair>,
    key: string,
    field: keyof CounterPair,
    amount: number,
    tenantFilter: string | null,
  ): void {
    if (tenantFilter && key !== tenantFilter) {
      return;
    }

    const current = target.get(key) || { hits: 0, blocked: 0 };
    current[field] += amount;
    target.set(key, current);
  }

  private mapCounterMap(map: Map<string, CounterPair>, tenantFilter: string | null) {
    const list = Array.from(map.entries()).map(([key, value]) => ({
      key,
      hits: value.hits,
      blocked: value.blocked,
      blockRate: this.computeRate(value.blocked, value.hits),
    }));
    const sorted = list.sort((a, b) => b.hits - a.hits);

    if (tenantFilter) {
      return sorted.filter((entry) => entry.key === tenantFilter);
    }

    return sorted;
  }

  private mapEndpointMap(map: Map<string, number>, top: number) {
    return Array.from(map.entries())
      .map(([member, hits]) => {
        const [tenantId, ...pathParts] = member.split('|');
        return {
          tenantId: tenantId || 'anonymous',
          path: pathParts.join('|'),
          hits,
        };
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, top);
  }

  private listBuckets(hours: number): string[] {
    const list: string[] = [];
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);

    for (let i = 0; i < hours; i++) {
      const date = new Date(now.getTime() - i * 3600 * 1000);
      list.push(this.getBucketKey(date));
    }
    return list;
  }

  private getBucketKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}${month}${day}${hour}`;
  }

  private normalizeTenant(tenantId?: string | null): string {
    const normalized = String(tenantId || '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : 'anonymous';
  }

  private normalizePath(path: string): string {
    const raw = String(path || '/').trim().toLowerCase();
    const [withoutQuery] = raw.split('?');
    return withoutQuery || '/';
  }

  private computeRate(blocked: number, hits: number): number {
    if (!hits) {
      return 0;
    }
    return Number(((blocked / hits) * 100).toFixed(2));
  }

  private parseNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private bumpMap(target: Map<string, number>, key: string, amount: number): void {
    target.set(key, (target.get(key) || 0) + amount);
  }

  private pruneMemoryBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.memoryBuckets.entries()) {
      if (bucket.expiresAt <= now) {
        this.memoryBuckets.delete(key);
      }
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private readEnvNumber(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }
}
