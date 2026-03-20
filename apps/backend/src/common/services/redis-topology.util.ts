import Redis, { Cluster } from 'ioredis';

export type RedisClientLike = Redis | Cluster;
export type RedisTopologyMode = 'disabled' | 'standalone' | 'sentinel' | 'cluster';
export type RedisFallbackMode = 'memory' | 'explicit' | 'strict';

export type RedisNodeAddress = {
  host: string;
  port: number;
};

export type RedisTopologyConfig = {
  mode: RedisTopologyMode;
  enabled: boolean;
  valid: boolean;
  configured: boolean;
  required: boolean;
  fallbackMode: RedisFallbackMode;
  connectTimeoutMs: number;
  retryCooldownMs: number;
  invalidReason: string | null;
  standalone?: RedisNodeAddress & {
    username?: string;
    password?: string;
    db?: number;
  };
  sentinel?: {
    masterName: string;
    sentinels: RedisNodeAddress[];
    username?: string;
    password?: string;
    sentinelUsername?: string;
    sentinelPassword?: string;
    db?: number;
    role?: 'master' | 'slave';
  };
  cluster?: {
    nodes: RedisNodeAddress[];
    username?: string;
    password?: string;
  };
};

export type RedisHealthSnapshot = {
  enabled: boolean;
  valid: boolean;
  configured: boolean;
  mode: RedisTopologyMode;
  ready: boolean;
  fallbackActive: boolean;
  required: boolean;
  fallbackMode: RedisFallbackMode;
  status: string;
  detail: string | null;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 1_500;
const DEFAULT_RETRY_COOLDOWN_MS = 15_000;

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function parseInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseNodeAddresses(rawValue: string): RedisNodeAddress[] {
  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [hostPart, portPart] = entry.split(':');
      const host = normalizeText(hostPart);
      const port = parseInteger(portPart, 6379, 1, 65535);

      if (!host) {
        return null;
      }

      return {
        host,
        port,
      } satisfies RedisNodeAddress;
    })
    .filter((entry): entry is RedisNodeAddress => Boolean(entry));
}

function normalizeFallbackMode(value: unknown): RedisFallbackMode {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'memory' || normalized === 'strict') {
    return normalized;
  }

  return 'explicit';
}

function normalizeTopologyMode(value: unknown): RedisTopologyMode | null {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === 'disabled' ||
    normalized === 'standalone' ||
    normalized === 'sentinel' ||
    normalized === 'cluster'
  ) {
    return normalized;
  }

  return null;
}

export function resolveRedisTopologyConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    fallbackModeEnvKey?: string;
    requiredEnvKey?: string;
  } = {},
): RedisTopologyConfig {
  const host = normalizeText(env.REDIS_HOST);
  const clusterNodes = parseNodeAddresses(normalizeText(env.REDIS_CLUSTER_NODES));
  const sentinels = parseNodeAddresses(normalizeText(env.REDIS_SENTINELS));
  const explicitMode = normalizeTopologyMode(env.REDIS_MODE);
  const enabled =
    normalizeText(env.REDIS_ENABLED).toLowerCase() !== 'false' &&
    explicitMode !== 'disabled';
  const fallbackMode = normalizeFallbackMode(
    env[options.fallbackModeEnvKey || 'REDIS_FALLBACK_MODE'],
  );
  const required =
    normalizeText(env[options.requiredEnvKey || 'REDIS_REQUIRED']).toLowerCase() === 'true' ||
    fallbackMode === 'strict';
  const connectTimeoutMs = parseInteger(
    env.REDIS_CONNECT_TIMEOUT,
    DEFAULT_CONNECT_TIMEOUT_MS,
    250,
    60_000,
  );
  const retryCooldownMs = parseInteger(
    env.REDIS_RETRY_COOLDOWN_MS,
    DEFAULT_RETRY_COOLDOWN_MS,
    1_000,
    10 * 60_000,
  );

  if (!enabled) {
    return {
      mode: 'disabled',
      enabled: false,
      valid: true,
      configured: explicitMode !== null || host.length > 0 || clusterNodes.length > 0 || sentinels.length > 0,
      required,
      fallbackMode,
      connectTimeoutMs,
      retryCooldownMs,
      invalidReason: null,
    };
  }

  const inferredMode =
    explicitMode ||
    (clusterNodes.length > 0
      ? 'cluster'
      : sentinels.length > 0
        ? 'sentinel'
        : host
          ? 'standalone'
          : 'disabled');

  if (inferredMode === 'cluster') {
    const valid = clusterNodes.length > 0;
    return {
      mode: 'cluster',
      enabled: true,
      valid,
      configured: true,
      required,
      fallbackMode,
      connectTimeoutMs,
      retryCooldownMs,
      invalidReason: valid ? null : 'redis-cluster-nodes-missing',
      cluster: {
        nodes: clusterNodes,
        username: normalizeText(env.REDIS_USERNAME) || undefined,
        password: normalizeText(env.REDIS_PASSWORD) || undefined,
      },
    };
  }

  if (inferredMode === 'sentinel') {
    const valid = sentinels.length > 0;
    return {
      mode: 'sentinel',
      enabled: true,
      valid,
      configured: true,
      required,
      fallbackMode,
      connectTimeoutMs,
      retryCooldownMs,
      invalidReason: valid ? null : 'redis-sentinels-missing',
      sentinel: {
        masterName: normalizeText(env.REDIS_MASTER_NAME) || 'mymaster',
        sentinels,
        username: normalizeText(env.REDIS_USERNAME) || undefined,
        password: normalizeText(env.REDIS_PASSWORD) || undefined,
        sentinelUsername: normalizeText(env.REDIS_SENTINEL_USERNAME) || undefined,
        sentinelPassword: normalizeText(env.REDIS_SENTINEL_PASSWORD) || undefined,
        db: parseInteger(env.REDIS_DB, 0, 0, Number.MAX_SAFE_INTEGER),
        role: normalizeText(env.REDIS_SENTINEL_ROLE).toLowerCase() === 'slave' ? 'slave' : 'master',
      },
    };
  }

  if (inferredMode === 'standalone') {
    const valid = host.length > 0;
    return {
      mode: 'standalone',
      enabled: true,
      valid,
      configured: true,
      required,
      fallbackMode,
      connectTimeoutMs,
      retryCooldownMs,
      invalidReason: valid ? null : 'redis-standalone-host-missing',
      standalone: {
        host: host || '127.0.0.1',
        port: parseInteger(env.REDIS_PORT, 6379, 1, 65535),
        username: normalizeText(env.REDIS_USERNAME) || undefined,
        password: normalizeText(env.REDIS_PASSWORD) || undefined,
        db: parseInteger(env.REDIS_DB, 0, 0, Number.MAX_SAFE_INTEGER),
      },
    };
  }

  return {
    mode: 'disabled',
    enabled: false,
    valid: true,
    configured: false,
    required,
    fallbackMode,
    connectTimeoutMs,
    retryCooldownMs,
    invalidReason: null,
  };
}

export function createRedisClientFromTopology(
  config: RedisTopologyConfig,
): RedisClientLike | undefined {
  if (!config.enabled || config.mode === 'disabled') {
    return undefined;
  }

  if (!config.valid) {
    return undefined;
  }

  if (config.mode === 'cluster' && config.cluster && config.cluster.nodes.length > 0) {
    return new Cluster(config.cluster.nodes, {
      enableOfflineQueue: false,
      slotsRefreshTimeout: config.connectTimeoutMs,
      redisOptions: {
        username: config.cluster.username,
        password: config.cluster.password,
        connectTimeout: config.connectTimeoutMs,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      },
      clusterRetryStrategy: () => null,
    });
  }

  if (config.mode === 'sentinel' && config.sentinel && config.sentinel.sentinels.length > 0) {
    return new Redis({
      sentinels: config.sentinel.sentinels,
      name: config.sentinel.masterName,
      username: config.sentinel.username,
      password: config.sentinel.password,
      sentinelUsername: config.sentinel.sentinelUsername,
      sentinelPassword: config.sentinel.sentinelPassword,
      db: config.sentinel.db,
      role: config.sentinel.role,
      connectTimeout: config.connectTimeoutMs,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  if (config.mode === 'standalone' && config.standalone) {
    return new Redis({
      host: config.standalone.host,
      port: config.standalone.port,
      username: config.standalone.username,
      password: config.standalone.password,
      db: config.standalone.db,
      connectTimeout: config.connectTimeoutMs,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  return undefined;
}

export async function connectRedisClient(client: RedisClientLike | undefined): Promise<void> {
  if (!client) {
    return;
  }

  const status = getRedisClientStatus(client);
  if (status === 'ready' || status === 'connecting') {
    return;
  }

  await client.connect();
}

export async function quitRedisClient(client: RedisClientLike | undefined): Promise<void> {
  if (!client) {
    return;
  }

  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export function getRedisClientStatus(client: RedisClientLike | undefined): string {
  if (!client) {
    return 'disabled';
  }

  return normalizeText((client as { status?: string }).status) || 'unknown';
}

export function isRedisClientReady(client: RedisClientLike | undefined): boolean {
  return getRedisClientStatus(client) === 'ready';
}

export async function pingRedisClient(client: RedisClientLike | undefined): Promise<string> {
  if (!client) {
    throw new Error('Redis client is not configured');
  }

  const result = await client.ping();
  return typeof result === 'string' ? result : String(result);
}

export function describeRedisTopology(config: RedisTopologyConfig): string {
  if (!config.enabled || config.mode === 'disabled') {
    return 'disabled';
  }

  if (!config.valid) {
    return `${config.mode}(invalid:${config.invalidReason || 'unknown'})`;
  }

  if (config.mode === 'cluster') {
    return `cluster(${config.cluster?.nodes.length || 0} nodes)`;
  }

  if (config.mode === 'sentinel') {
    return `sentinel(${config.sentinel?.masterName || 'mymaster'}, ${config.sentinel?.sentinels.length || 0} sentinels)`;
  }

  return `standalone(${config.standalone?.host || '127.0.0.1'}:${config.standalone?.port || 6379})`;
}

export function buildRedisHealthSnapshot(input: {
  config: RedisTopologyConfig;
  client: RedisClientLike | undefined;
  fallbackActive: boolean;
  detail?: string | null;
}): RedisHealthSnapshot {
  const detail = classifyRedisHealthDetail(input.config, input.detail || null);
  return {
    enabled: input.config.enabled,
    valid: input.config.valid,
    configured: input.config.configured,
    mode: input.config.mode,
    ready: isRedisClientReady(input.client),
    fallbackActive: input.fallbackActive,
    required: input.config.required,
    fallbackMode: input.config.fallbackMode,
    status: getRedisClientStatus(input.client),
    detail,
  };
}

export function classifyRedisHealthDetail(
  config: RedisTopologyConfig,
  detail: string | null,
): string | null {
  if (!config.valid) {
    return config.invalidReason;
  }

  const normalizedDetail = normalizeText(detail).toLowerCase();
  if (!normalizedDetail) {
    return null;
  }

  if (
    normalizedDetail.includes('all sentinels are unreachable') ||
    normalizedDetail.includes('sentinel')
  ) {
    return 'redis-sentinel-unreachable';
  }

  if (
    normalizedDetail.includes('clusterallfailederror') ||
    normalizedDetail.includes('failed to refresh slots cache') ||
    normalizedDetail.includes('cluster')
  ) {
    return 'redis-cluster-partial-unavailable';
  }

  if (normalizedDetail.includes('etimedout') || normalizedDetail.includes('timeout')) {
    return 'redis-timeout';
  }

  if (normalizedDetail.includes('econnrefused')) {
    return 'redis-connection-refused';
  }

  if (normalizedDetail.includes('enotfound')) {
    return 'redis-dns-resolution-failed';
  }

  return sanitizeOpaqueDetail(detail);
}

function sanitizeOpaqueDetail(value: string | null): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 160);
}
