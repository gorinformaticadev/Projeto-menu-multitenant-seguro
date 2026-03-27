import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type {
  ContractAnomalyDtoSummary,
  ContractAnomalyMinuteSummary,
  ContractAnomalyOriginSummary,
  ContractAnomalyRecord,
  ContractAnomalySnapshot,
  ContractAnomalySummary,
  ContractAnomalyTenantSummary,
  ContractCalibrationMetricSuggestion,
  ContractCalibrationSnapshot,
  ContractCardinalitySnapshot,
  ContractDimensionClassification,
  ContractEvaluatedEvent,
  ContractEventOrigin,
  ContractMetricSeverity,
  ContractObservabilityThresholds,
  ContractOperationType,
  ContractPersistenceSnapshot,
  ContractSnapshotOptions,
  ContractTrendSnapshot,
} from './contract-observability.types';
import {
  normalizeTelemetryMethod,
  normalizeTelemetryPath,
  resolveContractOperationType,
} from './system-telemetry.util';

type ContractDistributionAggregate = {
  dto: string;
  type: 'payload_stripped' | 'validation_failed';
  count: number;
  detailCount: number;
  lastOccurrenceAt: number;
};

type ContractDtoAggregate = {
  dto: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: number;
  routes: Map<string, number>;
};

type ContractRouteAggregate = {
  route: string;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  operationType: ContractOperationType | null;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: number;
};

type ContractTenantAggregate = {
  tenantHash: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: number;
};

type ContractOriginAggregate = {
  origin: ContractEventOrigin;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  requests: number;
  evaluations: number;
};

type ContractMinuteBucket = {
  minuteStartMs: number;
  totalEvents: number;
  totalValidationErrors: number;
  totalPayloadStrips: number;
  totalDetails: number;
  totalEvaluations: number;
  wsEvaluations: number;
  httpRequests: number;
  distribution: Map<string, ContractDistributionAggregate>;
  dto: Map<string, ContractDtoAggregate>;
  route: Map<string, ContractRouteAggregate>;
  tenant: Map<string, ContractTenantAggregate>;
  origin: Map<ContractEventOrigin, ContractOriginAggregate>;
  requestCountsByRoute: Map<string, number>;
  evaluationCountsByRoute: Map<string, number>;
  trackedValues: {
    dto: Set<string>;
    route: Set<string>;
    tenantHash: Set<string>;
  };
  overflowedEvents: {
    dto: number;
    route: number;
    tenantHash: number;
  };
};

type PersistedContractDtoAggregate = {
  dto: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: number;
  routes: Array<[string, number]>;
};

type PersistedContractMinuteBucket = {
  minuteStartMs: number;
  totalEvents: number;
  totalValidationErrors: number;
  totalPayloadStrips: number;
  totalDetails: number;
  totalEvaluations: number;
  wsEvaluations: number;
  httpRequests: number;
  distribution: Array<[string, ContractDistributionAggregate]>;
  dto: Array<[string, PersistedContractDtoAggregate]>;
  route: Array<[string, ContractRouteAggregate]>;
  tenant: Array<[string, ContractTenantAggregate]>;
  origin: Array<[ContractEventOrigin, ContractOriginAggregate]>;
  requestCountsByRoute: Array<[string, number]>;
  evaluationCountsByRoute: Array<[string, number]>;
  trackedValues: {
    dto: string[];
    route: string[];
    tenantHash: string[];
  };
  overflowedEvents: {
    dto: number;
    route: number;
    tenantHash: number;
  };
};

type WindowAggregate = {
  totalEvents: number;
  totalValidationErrors: number;
  totalPayloadStrips: number;
  totalDetails: number;
  totalEvaluations: number;
  wsEvaluations: number;
  httpRequests: number;
  distribution: Map<string, ContractDistributionAggregate>;
  dto: Map<string, ContractDtoAggregate>;
  route: Map<string, ContractRouteAggregate>;
  tenant: Map<string, ContractTenantAggregate>;
  origin: Map<ContractEventOrigin, ContractOriginAggregate>;
  requestCountsByRoute: Map<string, number>;
  evaluationCountsByRoute: Map<string, number>;
  trackedValues: {
    dto: Set<string>;
    route: Set<string>;
    tenantHash: Set<string>;
    method: Set<string>;
    module: Set<string>;
    origin: Set<string>;
    operationType: Set<string>;
  };
  overflowedEvents: {
    dto: number;
    route: number;
    tenantHash: number;
  };
};

type BucketsLoadResult = {
  buckets: Map<number, ContractMinuteBucket>;
  persistedWindowAvailable: boolean;
};

const DEFAULT_RETENTION_MINUTES = 6 * 60;
const DEFAULT_DTO_CARDINALITY_LIMIT = 40;
const DEFAULT_ROUTE_CARDINALITY_LIMIT = 60;
const DEFAULT_TENANT_CARDINALITY_LIMIT = 20;
const DEFAULT_TOP_LIMIT = 10;
const DEFAULT_REDIS_PREFIX = 'contract-observability';
const DEFAULT_REDIS_CONNECT_TIMEOUT = 1000;
const DEFAULT_REDIS_RETRY_COOLDOWN_MS = 15_000;
const DEFAULT_CALIBRATION_WINDOW_MINUTES = 6 * 60;
const CONTRACT_TREND_LOOKBACK_MINUTES = 60;
const OTHER_DTO_BUCKET = 'other';
const OTHER_ROUTE_BUCKET = '/__other__';
const OTHER_TENANT_BUCKET = 'other';

export class ContractObservabilityStore {
  private readonly logger = new Logger(ContractObservabilityStore.name);
  private readonly buckets = new Map<number, ContractMinuteBucket>();
  private readonly pendingSyncBuckets = new Set<number>();
  private readonly instanceId =
    String(process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || 'single-instance').trim() ||
    'single-instance';
  private readonly retentionMinutes = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_RETENTION_MINUTES',
    DEFAULT_RETENTION_MINUTES,
    30,
    24 * 60,
  );
  private readonly dtoLimit = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_DTO_CARDINALITY_LIMIT',
    DEFAULT_DTO_CARDINALITY_LIMIT,
    5,
    500,
  );
  private readonly routeLimit = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_ROUTE_CARDINALITY_LIMIT',
    DEFAULT_ROUTE_CARDINALITY_LIMIT,
    5,
    500,
  );
  private readonly tenantLimit = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_TENANT_CARDINALITY_LIMIT',
    DEFAULT_TENANT_CARDINALITY_LIMIT,
    5,
    200,
  );
  private readonly calibrationWindowMinutes = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_CALIBRATION_WINDOW_MINUTES',
    DEFAULT_CALIBRATION_WINDOW_MINUTES,
    30,
    24 * 60,
  );
  private readonly redisPrefix =
    String(process.env.CONTRACT_OBSERVABILITY_REDIS_PREFIX || DEFAULT_REDIS_PREFIX).trim() ||
    DEFAULT_REDIS_PREFIX;
  private readonly redisRetryCooldownMs = this.readEnvNumber(
    'CONTRACT_OBSERVABILITY_REDIS_RETRY_COOLDOWN_MS',
    DEFAULT_REDIS_RETRY_COOLDOWN_MS,
    1000,
    60_000,
  );
  private readonly redisEnabled: boolean;
  private readonly redis?: Redis;
  private redisRetryAvailableAt = 0;
  private redisHealthy = false;
  private redisFallbackActive = false;
  private lastRedisError: string | null = null;
  private flushPromise: Promise<void> | null = null;
  private lastObservedMinuteStartMs: number | null = null;

  constructor() {
    const redisHostConfigured = String(process.env.REDIS_HOST || '').trim().length > 0;
    const redisToggle = String(process.env.CONTRACT_OBSERVABILITY_REDIS_ENABLED || '').trim().toLowerCase();
    this.redisEnabled =
      redisHostConfigured &&
      (redisToggle === 'true' || (redisToggle !== 'false' && process.env.NODE_ENV === 'production'));

    if (!this.redisEnabled) {
      return;
    }

    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      connectTimeout: this.readEnvNumber(
        'CONTRACT_OBSERVABILITY_REDIS_CONNECT_TIMEOUT',
        DEFAULT_REDIS_CONNECT_TIMEOUT,
        250,
        10_000,
      ),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('ready', () => {
      this.redisHealthy = true;
      this.redisFallbackActive = false;
      this.lastRedisError = null;
    });

    this.redis.on('error', (error) => {
      this.markRedisUnavailable(error instanceof Error ? error.message : String(error));
    });
  }

  async destroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  recordHttpRequest(input: { at: number; route: string; method: string }): void {
    const at = this.normalizeTimestamp(input.at);
    const minuteStartMs = this.toMinuteStart(at);
    this.rotatePersistenceWindow(minuteStartMs);
    const bucket = this.getOrCreateBucket(minuteStartMs);
    const route = this.normalizeRoute(input.route, 'http');
    const method = this.normalizeMethod(input.method, 'http');
    const operationType = this.normalizeOperationType(resolveContractOperationType(method, 'http'));
    const routeKey = this.buildRouteAggregateKey(route, method, 'http', operationType);

    bucket.httpRequests += 1;
    bucket.requestCountsByRoute.set(routeKey, (bucket.requestCountsByRoute.get(routeKey) || 0) + 1);
    this.getOrCreateOriginAggregate(bucket.origin, 'http').requests += 1;
    this.markBucketDirty(minuteStartMs);
  }

  recordEvaluation(input: ContractEvaluatedEvent): void {
    const at = this.normalizeTimestamp(input.timestamp);
    const minuteStartMs = this.toMinuteStart(at);
    this.rotatePersistenceWindow(minuteStartMs);
    const bucket = this.getOrCreateBucket(minuteStartMs);
    const origin = this.normalizeOrigin(input.origin);
    const route = this.normalizeRoute(input.route, origin);
    const method = this.normalizeMethod(input.method, origin);
    const operationType = this.normalizeOperationType(input.operationType, method, origin);
    const routeKey = this.buildRouteAggregateKey(route, method, origin, operationType);

    bucket.totalEvaluations += 1;
    if (origin === 'ws') {
      bucket.wsEvaluations += 1;
    }

    bucket.evaluationCountsByRoute.set(routeKey, (bucket.evaluationCountsByRoute.get(routeKey) || 0) + 1);
    this.getOrCreateOriginAggregate(bucket.origin, origin).evaluations += 1;
    this.markBucketDirty(minuteStartMs);
  }

  recordAnomaly(input: ContractAnomalyRecord): void {
    const at = this.normalizeTimestamp(input.at);
    const minuteStartMs = this.toMinuteStart(at);
    this.rotatePersistenceWindow(minuteStartMs);
    const bucket = this.getOrCreateBucket(minuteStartMs);
    const origin = this.normalizeOrigin(input.origin);
    const method = this.normalizeMethod(input.method, origin);
    const route = this.normalizeRoute(input.route, origin);
    const moduleName = this.normalizeModule(input.module);
    const operationType = this.normalizeOperationType(input.operationType, method, origin);
    const detailCount = this.normalizeDetailCount(input.detailCount);
    const dto = this.bucketDimension(bucket.trackedValues.dto, this.dtoLimit, input.dto, OTHER_DTO_BUCKET, () => {
      bucket.overflowedEvents.dto += 1;
    });
    const trackedRoute = this.bucketDimension(
      bucket.trackedValues.route,
      this.routeLimit,
      route,
      OTHER_ROUTE_BUCKET,
      () => {
        bucket.overflowedEvents.route += 1;
      },
    );
    const tenantHash = this.bucketDimension(
      bucket.trackedValues.tenantHash,
      this.tenantLimit,
      this.normalizeTenant(input.tenantHash),
      OTHER_TENANT_BUCKET,
      () => {
        bucket.overflowedEvents.tenantHash += 1;
      },
    );
    const routeKey = this.buildRouteAggregateKey(trackedRoute, method, origin, operationType);

    bucket.totalEvents += 1;
    bucket.totalDetails += detailCount;
    if (input.type === 'validation_failed') {
      bucket.totalValidationErrors += 1;
    } else {
      bucket.totalPayloadStrips += 1;
    }

    const distributionKey = `${input.type}:${dto}`;
    const distribution = this.getOrCreateDistributionAggregate(bucket.distribution, distributionKey, dto, input.type);
    distribution.count += 1;
    distribution.detailCount += detailCount;
    distribution.lastOccurrenceAt = at;

    const dtoAggregate = this.getOrCreateDtoAggregate(bucket.dto, dto);
    dtoAggregate.count += 1;
    dtoAggregate.detailCount += detailCount;
    dtoAggregate.lastOccurrenceAt = at;
    dtoAggregate.routes.set(trackedRoute, (dtoAggregate.routes.get(trackedRoute) || 0) + 1);
    if (input.type === 'validation_failed') {
      dtoAggregate.validationFailed += 1;
    } else {
      dtoAggregate.payloadStripped += 1;
    }

    const routeAggregate = this.getOrCreateRouteAggregate(
      bucket.route,
      routeKey,
      trackedRoute,
      method,
      moduleName,
      origin,
      operationType,
    );
    routeAggregate.count += 1;
    routeAggregate.detailCount += detailCount;
    routeAggregate.lastOccurrenceAt = at;
    routeAggregate.module = this.mergeNullableLabel(routeAggregate.module, moduleName);
    if (input.type === 'validation_failed') {
      routeAggregate.validationFailed += 1;
    } else {
      routeAggregate.payloadStripped += 1;
    }

    const tenantAggregate = this.getOrCreateTenantAggregate(bucket.tenant, tenantHash);
    tenantAggregate.count += 1;
    tenantAggregate.detailCount += detailCount;
    tenantAggregate.lastOccurrenceAt = at;
    if (input.type === 'validation_failed') {
      tenantAggregate.validationFailed += 1;
    } else {
      tenantAggregate.payloadStripped += 1;
    }

    const originAggregate = this.getOrCreateOriginAggregate(bucket.origin, origin);
    originAggregate.count += 1;
    originAggregate.detailCount += detailCount;
    if (input.type === 'validation_failed') {
      originAggregate.validationFailed += 1;
    } else {
      originAggregate.payloadStripped += 1;
    }

    this.markBucketDirty(minuteStartMs);
  }

  async getSnapshot(
    windowMs: number,
    thresholds: ContractObservabilityThresholds,
    options: ContractSnapshotOptions = {},
  ): Promise<ContractAnomalySnapshot> {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, 10 * 60 * 1000);
    const topLimit = Math.max(1, Number(options.topLimit || DEFAULT_TOP_LIMIT));
    const includeCalibration = options.includeCalibration !== false;
    const nowMs = Date.now();
    const currentEndMinute = this.resolveWindowEndMinute(this.toMinuteStart(nowMs));
    const currentStartMinute = this.toMinuteStart(nowMs - normalizedWindowMs);
    const previousStartMinute = this.toMinuteStart(nowMs - normalizedWindowMs * 2);
    const trendStartMinute = currentEndMinute - (CONTRACT_TREND_LOOKBACK_MINUTES - 1) * 60_000;
    const observationMinutes = Math.min(this.retentionMinutes, this.calibrationWindowMinutes);
    const observationStartMinute = currentEndMinute - (observationMinutes - 1) * 60_000;
    const loadStartMinute = Math.min(previousStartMinute, trendStartMinute, observationStartMinute);

    this.pruneBuckets(nowMs);
    await this.persistDirtyBuckets(true);
    const loaded = await this.loadBuckets(loadStartMinute, currentEndMinute);
    const currentAggregate = this.aggregateBuckets(loaded.buckets, currentStartMinute, currentEndMinute);
    const previousAggregate = this.aggregateBuckets(
      loaded.buckets,
      previousStartMinute,
      currentStartMinute - 60_000,
    );

    const bucketMinutes = Math.max(1, thresholds.trend.bucketMinutes);
    const trendBuckets = this.buildTrendBuckets(
      loaded.buckets,
      currentEndMinute,
      bucketMinutes,
      Math.max(1, Math.floor(CONTRACT_TREND_LOOKBACK_MINUTES / bucketMinutes)),
    );
    const lastBucketIncreasePercent = this.computePercentageChange(
      trendBuckets[trendBuckets.length - 1] || 0,
      trendBuckets.length > 1 ? trendBuckets[trendBuckets.length - 2] : 0,
    );
    const continuousGrowthBuckets = this.resolveContinuousGrowthBuckets(trendBuckets);
    const continuousGrowthMinutes = continuousGrowthBuckets * bucketMinutes;
    const increasingForLastHour =
      continuousGrowthBuckets >= trendBuckets.length &&
      trendBuckets.reduce((total, value) => total + value, 0) >= thresholds.trend.minEventCount;
    const failureRatePerThousandRequests = this.computeRatePerThousand(
      currentAggregate.totalValidationErrors,
      currentAggregate.httpRequests,
    );
    const strippingRatePerThousandRequests = this.computeRatePerThousand(
      currentAggregate.totalPayloadStrips,
      currentAggregate.httpRequests,
    );
    const wsOrigin = currentAggregate.origin.get('ws');
    const wsFailureRatePerThousandEvents = this.computeRatePerThousand(
      wsOrigin?.validationFailed || 0,
      wsOrigin?.evaluations || 0,
    );
    const wsStrippingRatePerThousandEvents = this.computeRatePerThousand(
      wsOrigin?.payloadStripped || 0,
      wsOrigin?.evaluations || 0,
    );
    const byOrigin = this.buildOriginSummary(currentAggregate.origin, thresholds);
    const trends: ContractTrendSnapshot = {
      previousWindowStart: new Date(nowMs - normalizedWindowMs * 2).toISOString(),
      previousWindowSeconds: Math.floor(normalizedWindowMs / 1000),
      previousTotalEvents: previousAggregate.totalEvents,
      previousValidationErrors: previousAggregate.totalValidationErrors,
      previousPayloadStrips: previousAggregate.totalPayloadStrips,
      totalIncreasePercent: this.computePercentageChange(
        currentAggregate.totalEvents,
        previousAggregate.totalEvents,
      ),
      validationIncreasePercent: this.computePercentageChange(
        currentAggregate.totalValidationErrors,
        previousAggregate.totalValidationErrors,
      ),
      payloadIncreasePercent: this.computePercentageChange(
        currentAggregate.totalPayloadStrips,
        previousAggregate.totalPayloadStrips,
      ),
      lastBucketIncreasePercent,
      continuousGrowthMinutes,
      continuousGrowthBuckets,
      increasingForLastHour,
    };
    const severity = this.resolveSeverity(
      currentAggregate,
      thresholds,
      byOrigin,
      trends,
      failureRatePerThousandRequests,
      strippingRatePerThousandRequests,
    );

    return {
      status: 'ok',
      windowStart: new Date(nowMs - normalizedWindowMs).toISOString(),
      windowSeconds: Math.floor(normalizedWindowMs / 1000),
      requestsInWindow: currentAggregate.httpRequests,
      totalEvaluationsInWindow: currentAggregate.totalEvaluations,
      wsEvaluationsInWindow: currentAggregate.wsEvaluations,
      totalEvents: currentAggregate.totalEvents,
      totalValidationErrors: currentAggregate.totalValidationErrors,
      totalPayloadStrips: currentAggregate.totalPayloadStrips,
      totalDetails: currentAggregate.totalDetails,
      eventsPerMinuteAvg: Number(
        (
          currentAggregate.totalEvents /
          Math.max(1, this.countMinutesInRange(currentStartMinute, currentEndMinute))
        ).toFixed(2),
      ),
      failureRatePerThousandRequests,
      strippingRatePerThousandRequests,
      wsFailureRatePerThousandEvents,
      wsStrippingRatePerThousandEvents,
      distribution: this.buildDistributionSummary(currentAggregate.distribution, topLimit),
      byDto: this.buildDtoSummary(currentAggregate.dto, topLimit),
      byRoute: this.buildRouteSummary(
        currentAggregate.route,
        currentAggregate.requestCountsByRoute,
        currentAggregate.evaluationCountsByRoute,
        topLimit,
      ),
      byTenant: this.buildTenantSummary(currentAggregate.tenant, topLimit),
      byOrigin,
      eventsPerMinute: this.buildMinuteSeries(loaded.buckets, currentStartMinute, currentEndMinute),
      thresholds,
      trends,
      severity,
      persistence: this.buildPersistenceSnapshot(loaded.persistedWindowAvailable),
      cardinality: this.buildCardinalitySnapshot(currentAggregate),
      calibration: includeCalibration
        ? this.buildCalibrationSnapshot(
            loaded.buckets,
            observationStartMinute,
            currentEndMinute,
            normalizedWindowMs,
            thresholds,
          )
        : null,
    };
  }

  private buildPersistenceSnapshot(persistedWindowAvailable: boolean): ContractPersistenceSnapshot {
    return {
      mode: this.redisEnabled ? 'redis' : 'memory',
      redisEnabled: this.redisEnabled,
      redisHealthy: this.redisEnabled ? !this.redisFallbackActive && this.redisHealthy : false,
      persistedWindowAvailable,
      retentionMinutes: this.retentionMinutes,
      degraded: this.redisEnabled ? this.redisFallbackActive || !this.redisHealthy : false,
      pendingSyncBuckets: this.pendingSyncBuckets.size,
      lastError: this.lastRedisError,
    };
  }

  private buildCardinalitySnapshot(aggregate: WindowAggregate): ContractCardinalitySnapshot {
    const buildDimension = (
      classification: ContractDimensionClassification,
      limit: number | null,
      tracked: number,
      overflowedEvents = 0,
    ) => ({
      classification,
      limit,
      tracked,
      overflowedEvents,
    });

    return {
      dimensions: {
        dto: buildDimension('mandatory', this.dtoLimit, aggregate.trackedValues.dto.size, aggregate.overflowedEvents.dto),
        route: buildDimension('bucketed', this.routeLimit, aggregate.trackedValues.route.size, aggregate.overflowedEvents.route),
        tenantHash: buildDimension(
          'dangerous',
          this.tenantLimit,
          aggregate.trackedValues.tenantHash.size,
          aggregate.overflowedEvents.tenantHash,
        ),
        method: buildDimension('optional', null, aggregate.trackedValues.method.size),
        module: buildDimension('optional', null, aggregate.trackedValues.module.size),
        origin: buildDimension('mandatory', null, aggregate.trackedValues.origin.size),
        operationType: buildDimension('bucketed', null, aggregate.trackedValues.operationType.size),
      },
      totalOverflowedEvents:
        aggregate.overflowedEvents.dto +
        aggregate.overflowedEvents.route +
        aggregate.overflowedEvents.tenantHash,
    };
  }

  private buildCalibrationSnapshot(
    buckets: Map<number, ContractMinuteBucket>,
    startMinute: number,
    endMinute: number,
    evaluationWindowMs: number,
    thresholds: ContractObservabilityThresholds,
  ): ContractCalibrationSnapshot {
    const minutes = this.listMinutesInRange(startMinute, endMinute);
    const windowMinutes = Math.max(1, Math.ceil(evaluationWindowMs / 60_000));
    const minuteRows = minutes.map((minuteStartMs) => {
      const bucket = buckets.get(minuteStartMs);
      const wsOrigin = bucket?.origin.get('ws');
      return {
        validationFailed: bucket?.totalValidationErrors || 0,
        payloadStripped: bucket?.totalPayloadStrips || 0,
        totalEvents: bucket?.totalEvents || 0,
        requests: bucket?.httpRequests || 0,
        wsEvaluations: wsOrigin?.evaluations || 0,
      };
    });

    const sampleWindows = Math.max(0, minuteRows.length - windowMinutes + 1);
    const validationCounts: number[] = [];
    const payloadCounts: number[] = [];
    const validationHttpRates: number[] = [];
    const payloadHttpRates: number[] = [];
    const validationWsRates: number[] = [];
    const payloadWsRates: number[] = [];
    const increasePercents: number[] = [];

    let previousTotalEvents: number | null = null;
    for (let index = 0; index <= minuteRows.length - windowMinutes; index += 1) {
      const slice = minuteRows.slice(index, index + windowMinutes);
      const validationFailed = slice.reduce((total, row) => total + row.validationFailed, 0);
      const payloadStripped = slice.reduce((total, row) => total + row.payloadStripped, 0);
      const totalEvents = slice.reduce((total, row) => total + row.totalEvents, 0);
      const requests = slice.reduce((total, row) => total + row.requests, 0);
      const wsEvaluations = slice.reduce((total, row) => total + row.wsEvaluations, 0);

      validationCounts.push(validationFailed);
      payloadCounts.push(payloadStripped);
      if (requests > 0) {
        validationHttpRates.push(this.computeRatePerThousand(validationFailed, requests) || 0);
        payloadHttpRates.push(this.computeRatePerThousand(payloadStripped, requests) || 0);
      }
      if (wsEvaluations > 0) {
        validationWsRates.push(this.computeRatePerThousand(validationFailed, wsEvaluations) || 0);
        payloadWsRates.push(this.computeRatePerThousand(payloadStripped, wsEvaluations) || 0);
      }
      if (previousTotalEvents !== null) {
        const increase = this.computePercentageChange(totalEvents, previousTotalEvents);
        if (increase !== null) {
          increasePercents.push(increase);
        }
      }
      previousTotalEvents = totalEvents;
    }

    const trendObservedP95 = this.roundMetric(this.quantile(increasePercents, 0.95));
    const trendObservedPeak = this.roundMetric(increasePercents.length > 0 ? Math.max(...increasePercents) : 0);

    return {
      status: sampleWindows >= 6 ? 'ready' : 'collecting',
      observationWindowMinutes: this.countMinutesInRange(startMinute, endMinute),
      evaluationWindowMinutes: windowMinutes,
      sampleWindows,
      currentThresholds: thresholds,
      suggestions: {
        validationFailed: {
          volume: this.buildCalibrationSuggestion(validationCounts),
          httpRatePerThousandRequests: this.buildCalibrationSuggestion(validationHttpRates),
          wsRatePerThousandEvents: this.buildCalibrationSuggestion(validationWsRates),
        },
        payloadStripped: {
          volume: this.buildCalibrationSuggestion(payloadCounts),
          httpRatePerThousandRequests: this.buildCalibrationSuggestion(payloadHttpRates),
          wsRatePerThousandEvents: this.buildCalibrationSuggestion(payloadWsRates),
        },
        trend: {
          observedP95IncreasePercent: trendObservedP95,
          observedPeakIncreasePercent: trendObservedPeak,
          suggestedWarningPercent: Math.max(100, Math.ceil(Math.max(trendObservedP95 * 1.1, 100))),
          suggestedCriticalPercent: Math.max(
            200,
            Math.ceil(Math.max(trendObservedPeak * 1.1, Math.max(trendObservedP95 * 1.5, 200))),
          ),
        },
      },
    };
  }

  private buildCalibrationSuggestion(values: number[]): ContractCalibrationMetricSuggestion {
    const observedP95 = this.roundMetric(this.quantile(values, 0.95));
    const observedPeak = this.roundMetric(values.length > 0 ? Math.max(...values) : 0);
    const suggestedWarning = Math.max(1, Math.ceil(Math.max(observedP95 * 1.25, observedPeak > 0 ? observedP95 : 1)));
    const suggestedCritical = Math.max(
      suggestedWarning + 1,
      Math.ceil(Math.max(observedPeak * 1.1, suggestedWarning * 1.5)),
    );

    return {
      observedP95,
      observedPeak,
      suggestedWarning,
      suggestedCritical,
    };
  }

  private buildOriginSummary(
    source: Map<ContractEventOrigin, ContractOriginAggregate>,
    thresholds: ContractObservabilityThresholds,
  ): ContractAnomalyOriginSummary[] {
    return Array.from(source.values())
      .map((entry) => {
        const denominatorKind: 'requests' | 'events' = entry.origin === 'http' ? 'requests' : 'events';
        const denominatorCount = denominatorKind === 'requests' ? entry.requests : entry.evaluations;
        const failureRatePerThousand =
          this.computeRatePerThousand(entry.validationFailed, denominatorCount);
        const strippingRatePerThousand =
          this.computeRatePerThousand(entry.payloadStripped, denominatorCount);

        let severity: ContractMetricSeverity = 'normal';
        if (entry.origin === 'http') {
          if (
            entry.validationFailed >= thresholds.validationFailed.volume.critical ||
            entry.payloadStripped >= thresholds.payloadStripped.volume.critical ||
            (failureRatePerThousand !== null &&
              failureRatePerThousand >= thresholds.validationFailed.ratePerThousandRequests.critical) ||
            (strippingRatePerThousand !== null &&
              strippingRatePerThousand >= thresholds.payloadStripped.ratePerThousandRequests.critical)
          ) {
            severity = 'critical';
          } else if (
            entry.validationFailed >= thresholds.validationFailed.volume.warning ||
            entry.payloadStripped >= thresholds.payloadStripped.volume.warning ||
            (failureRatePerThousand !== null &&
              failureRatePerThousand >= thresholds.validationFailed.ratePerThousandRequests.warning) ||
            (strippingRatePerThousand !== null &&
              strippingRatePerThousand >= thresholds.payloadStripped.ratePerThousandRequests.warning)
          ) {
            severity = 'warning';
          }
        } else if (entry.origin === 'ws') {
          if (
            (failureRatePerThousand !== null &&
              failureRatePerThousand >= thresholds.ws.validationFailed.ratePerThousandEvents.critical) ||
            (strippingRatePerThousand !== null &&
              strippingRatePerThousand >= thresholds.ws.payloadStripped.ratePerThousandEvents.critical)
          ) {
            severity = 'critical';
          } else if (
            (failureRatePerThousand !== null &&
              failureRatePerThousand >= thresholds.ws.validationFailed.ratePerThousandEvents.warning) ||
            (strippingRatePerThousand !== null &&
              strippingRatePerThousand >= thresholds.ws.payloadStripped.ratePerThousandEvents.warning)
          ) {
            severity = 'warning';
          }
        }

        return {
          origin: entry.origin,
          count: entry.count,
          validationFailed: entry.validationFailed,
          payloadStripped: entry.payloadStripped,
          detailCount: entry.detailCount,
          denominatorKind,
          denominatorCount,
          failureRatePerThousand,
          strippingRatePerThousand,
          severity,
        };
      })
      .sort((left, right) => right.count - left.count || left.origin.localeCompare(right.origin));
  }

  private resolveSeverity(
    aggregate: WindowAggregate,
    thresholds: ContractObservabilityThresholds,
    byOrigin: ContractAnomalyOriginSummary[],
    trends: ContractTrendSnapshot,
    failureRatePerThousandRequests: number | null,
    strippingRatePerThousandRequests: number | null,
  ) {
    const validationOriginSeverity = byOrigin.reduce<ContractMetricSeverity>(
      (highest, entry) =>
        entry.validationFailed > 0 ? this.maxSeverity(highest, entry.severity) : highest,
      'normal',
    );
    const payloadOriginSeverity = byOrigin.reduce<ContractMetricSeverity>(
      (highest, entry) =>
        entry.payloadStripped > 0 ? this.maxSeverity(highest, entry.severity) : highest,
      'normal',
    );

    let validationFailed: ContractMetricSeverity = 'normal';
    if (
      aggregate.totalValidationErrors >= thresholds.validationFailed.volume.critical ||
      (failureRatePerThousandRequests !== null &&
        failureRatePerThousandRequests >= thresholds.validationFailed.ratePerThousandRequests.critical)
    ) {
      validationFailed = 'critical';
    } else if (
      aggregate.totalValidationErrors >= thresholds.validationFailed.volume.warning ||
      (failureRatePerThousandRequests !== null &&
        failureRatePerThousandRequests >= thresholds.validationFailed.ratePerThousandRequests.warning)
    ) {
      validationFailed = 'warning';
    }
    validationFailed = this.maxSeverity(validationFailed, validationOriginSeverity);

    let payloadStripped: ContractMetricSeverity = 'normal';
    if (
      aggregate.totalPayloadStrips >= thresholds.payloadStripped.volume.critical ||
      (strippingRatePerThousandRequests !== null &&
        strippingRatePerThousandRequests >= thresholds.payloadStripped.ratePerThousandRequests.critical)
    ) {
      payloadStripped = 'critical';
    } else if (
      aggregate.totalPayloadStrips >= thresholds.payloadStripped.volume.warning ||
      (strippingRatePerThousandRequests !== null &&
        strippingRatePerThousandRequests >= thresholds.payloadStripped.ratePerThousandRequests.warning)
    ) {
      payloadStripped = 'warning';
    }
    payloadStripped = this.maxSeverity(payloadStripped, payloadOriginSeverity);

    const trendSignals = [
      trends.totalIncreasePercent,
      trends.validationIncreasePercent,
      trends.payloadIncreasePercent,
      trends.lastBucketIncreasePercent,
    ].filter((value): value is number => value !== null);
    const maxTrendPercent = trendSignals.length > 0 ? Math.max(...trendSignals) : null;

    let trend: ContractMetricSeverity = 'normal';
    if (
      aggregate.totalEvents >= thresholds.trend.minEventCount &&
      ((maxTrendPercent !== null && maxTrendPercent >= thresholds.trend.criticalPercent) ||
        (trends.increasingForLastHour &&
          trends.continuousGrowthMinutes >= thresholds.trend.criticalGrowthMinutes))
    ) {
      trend = 'critical';
    } else if (
      aggregate.totalEvents >= thresholds.trend.minEventCount &&
      ((maxTrendPercent !== null && maxTrendPercent >= thresholds.trend.warningPercent) ||
        trends.continuousGrowthMinutes >= thresholds.trend.warningGrowthMinutes)
    ) {
      trend = 'warning';
    }

    return {
      validationFailed,
      payloadStripped,
      trend,
      overall: this.maxSeverity(this.maxSeverity(validationFailed, payloadStripped), trend),
    };
  }

  private buildDistributionSummary(
    source: Map<string, ContractDistributionAggregate>,
    topLimit: number,
  ): ContractAnomalySummary[] {
    return Array.from(source.values())
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.detailCount - left.detailCount ||
          right.lastOccurrenceAt - left.lastOccurrenceAt ||
          left.dto.localeCompare(right.dto)
        );
      })
      .slice(0, topLimit)
      .map((entry) => ({
        dto: entry.dto,
        type: entry.type,
        count: entry.count,
        detailCount: entry.detailCount,
        lastOccurrenceMs: entry.lastOccurrenceAt,
      }));
  }

  private buildDtoSummary(
    source: Map<string, ContractDtoAggregate>,
    topLimit: number,
  ): ContractAnomalyDtoSummary[] {
    return Array.from(source.values())
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.detailCount - left.detailCount ||
          right.lastOccurrenceAt - left.lastOccurrenceAt ||
          left.dto.localeCompare(right.dto)
        );
      })
      .slice(0, topLimit)
      .map((entry) => ({
        dto: entry.dto,
        count: entry.count,
        validationFailed: entry.validationFailed,
        payloadStripped: entry.payloadStripped,
        detailCount: entry.detailCount,
        lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
        topRoute: this.findTopRoute(entry.routes),
      }));
  }

  private buildRouteSummary(
    source: Map<string, ContractRouteAggregate>,
    requestCountsByRoute: Map<string, number>,
    evaluationCountsByRoute: Map<string, number>,
    topLimit: number,
  ) {
    return Array.from(source.entries())
      .map(([key, entry]) => {
        const requests = requestCountsByRoute.get(key) || 0;
        const evaluations = evaluationCountsByRoute.get(key) || 0;
        const denominatorKind: 'requests' | 'events' = entry.origin === 'http' ? 'requests' : 'events';
        const denominatorCount = denominatorKind === 'requests' ? requests : evaluations;
        const failureRatePerThousandRequests =
          denominatorKind === 'requests'
            ? this.computeRatePerThousand(entry.validationFailed, requests)
            : null;
        const strippingRatePerThousandRequests =
          denominatorKind === 'requests'
            ? this.computeRatePerThousand(entry.payloadStripped, requests)
            : null;
        const totalRatePerThousandRequests =
          denominatorKind === 'requests'
            ? this.computeRatePerThousand(entry.count, requests)
            : null;
        const failureRatePerThousandEvents =
          denominatorKind === 'events'
            ? this.computeRatePerThousand(entry.validationFailed, evaluations)
            : null;
        const strippingRatePerThousandEvents =
          denominatorKind === 'events'
            ? this.computeRatePerThousand(entry.payloadStripped, evaluations)
            : null;
        const totalRatePerThousandEvents =
          denominatorKind === 'events'
            ? this.computeRatePerThousand(entry.count, evaluations)
            : null;

        return {
          route: entry.route,
          method: entry.method,
          module: entry.module,
          origin: entry.origin,
          operationType: entry.operationType,
          count: entry.count,
          validationFailed: entry.validationFailed,
          payloadStripped: entry.payloadStripped,
          detailCount: entry.detailCount,
          requests,
          evaluations,
          denominatorKind,
          denominatorCount,
          failureRatePerThousandRequests,
          strippingRatePerThousandRequests,
          totalRatePerThousandRequests,
          failureRatePerThousandEvents,
          strippingRatePerThousandEvents,
          totalRatePerThousandEvents,
          lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
        };
      })
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.detailCount - left.detailCount ||
          (right.denominatorCount || 0) - (left.denominatorCount || 0) ||
          right.lastOccurrenceAt.localeCompare(left.lastOccurrenceAt) ||
          left.route.localeCompare(right.route)
        );
      })
      .slice(0, topLimit);
  }

  private buildTenantSummary(
    source: Map<string, ContractTenantAggregate>,
    topLimit: number,
  ): ContractAnomalyTenantSummary[] {
    return Array.from(source.values())
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.detailCount - left.detailCount ||
          right.lastOccurrenceAt - left.lastOccurrenceAt ||
          left.tenantHash.localeCompare(right.tenantHash)
        );
      })
      .slice(0, topLimit)
      .map((entry) => ({
        tenantHash: entry.tenantHash,
        count: entry.count,
        validationFailed: entry.validationFailed,
        payloadStripped: entry.payloadStripped,
        detailCount: entry.detailCount,
        lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
      }));
  }

  private buildMinuteSeries(
    buckets: Map<number, ContractMinuteBucket>,
    startMinute: number,
    endMinute: number,
  ): ContractAnomalyMinuteSummary[] {
    return this.listMinutesInRange(startMinute, endMinute).map((minuteStartMs) => {
      const bucket = buckets.get(minuteStartMs);
      return {
        minuteStart: new Date(minuteStartMs).toISOString(),
        total: bucket?.totalEvents || 0,
        validationFailed: bucket?.totalValidationErrors || 0,
        payloadStripped: bucket?.totalPayloadStrips || 0,
        httpRequests: bucket?.httpRequests || 0,
        wsEvaluations: bucket?.origin.get('ws')?.evaluations || 0,
      };
    });
  }

  private buildTrendBuckets(
    buckets: Map<number, ContractMinuteBucket>,
    endMinute: number,
    bucketMinutes: number,
    bucketCount: number,
  ): number[] {
    const minuteStart = endMinute - (bucketCount * bucketMinutes - 1) * 60_000;
    const totalsByMinute = new Map<number, number>();
    for (const minute of this.listMinutesInRange(minuteStart, endMinute)) {
      totalsByMinute.set(minute, buckets.get(minute)?.totalEvents || 0);
    }

    const trendBuckets: number[] = [];
    for (let index = 0; index < bucketCount; index += 1) {
      const bucketStart = minuteStart + index * bucketMinutes * 60_000;
      let total = 0;
      for (let offset = 0; offset < bucketMinutes; offset += 1) {
        total += totalsByMinute.get(bucketStart + offset * 60_000) || 0;
      }
      trendBuckets.push(total);
    }

    return trendBuckets;
  }

  private resolveContinuousGrowthBuckets(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    let total = 1;
    for (let index = values.length - 1; index > 0; index -= 1) {
      if (values[index] > values[index - 1]) {
        total += 1;
        continue;
      }
      break;
    }
    return total;
  }

  private aggregateBuckets(
    source: Map<number, ContractMinuteBucket>,
    startMinute: number,
    endMinute: number,
  ): WindowAggregate {
    const aggregate: WindowAggregate = {
      totalEvents: 0,
      totalValidationErrors: 0,
      totalPayloadStrips: 0,
      totalDetails: 0,
      totalEvaluations: 0,
      wsEvaluations: 0,
      httpRequests: 0,
      distribution: new Map(),
      dto: new Map(),
      route: new Map(),
      tenant: new Map(),
      origin: new Map(),
      requestCountsByRoute: new Map(),
      evaluationCountsByRoute: new Map(),
      trackedValues: {
        dto: new Set(),
        route: new Set(),
        tenantHash: new Set(),
        method: new Set(),
        module: new Set(),
        origin: new Set(),
        operationType: new Set(),
      },
      overflowedEvents: {
        dto: 0,
        route: 0,
        tenantHash: 0,
      },
    };

    for (const minute of this.listMinutesInRange(startMinute, endMinute)) {
      const bucket = source.get(minute);
      if (!bucket) {
        continue;
      }

      aggregate.totalEvents += bucket.totalEvents;
      aggregate.totalValidationErrors += bucket.totalValidationErrors;
      aggregate.totalPayloadStrips += bucket.totalPayloadStrips;
      aggregate.totalDetails += bucket.totalDetails;
      aggregate.totalEvaluations += bucket.totalEvaluations;
      aggregate.wsEvaluations += bucket.wsEvaluations;
      aggregate.httpRequests += bucket.httpRequests;

      for (const [key, entry] of bucket.distribution.entries()) {
        const target = this.getOrCreateDistributionAggregate(aggregate.distribution, key, entry.dto, entry.type);
        target.count += entry.count;
        target.detailCount += entry.detailCount;
        target.lastOccurrenceAt = Math.max(target.lastOccurrenceAt, entry.lastOccurrenceAt);
      }

      for (const [key, entry] of bucket.dto.entries()) {
        const target = this.getOrCreateDtoAggregate(aggregate.dto, key);
        target.count += entry.count;
        target.validationFailed += entry.validationFailed;
        target.payloadStripped += entry.payloadStripped;
        target.detailCount += entry.detailCount;
        target.lastOccurrenceAt = Math.max(target.lastOccurrenceAt, entry.lastOccurrenceAt);
        for (const [route, count] of entry.routes.entries()) {
          target.routes.set(route, (target.routes.get(route) || 0) + count);
        }
      }

      for (const [key, entry] of bucket.route.entries()) {
        const target = this.getOrCreateRouteAggregate(
          aggregate.route,
          key,
          entry.route,
          entry.method,
          entry.module,
          entry.origin,
          entry.operationType,
        );
        target.count += entry.count;
        target.validationFailed += entry.validationFailed;
        target.payloadStripped += entry.payloadStripped;
        target.detailCount += entry.detailCount;
        target.lastOccurrenceAt = Math.max(target.lastOccurrenceAt, entry.lastOccurrenceAt);
        target.module = this.mergeNullableLabel(target.module, entry.module);
        if (entry.method) {
          aggregate.trackedValues.method.add(entry.method);
        }
        if (entry.module) {
          aggregate.trackedValues.module.add(entry.module);
        }
        aggregate.trackedValues.origin.add(entry.origin);
        if (entry.operationType) {
          aggregate.trackedValues.operationType.add(entry.operationType);
        }
      }

      for (const [key, entry] of bucket.tenant.entries()) {
        const target = this.getOrCreateTenantAggregate(aggregate.tenant, key);
        target.count += entry.count;
        target.validationFailed += entry.validationFailed;
        target.payloadStripped += entry.payloadStripped;
        target.detailCount += entry.detailCount;
        target.lastOccurrenceAt = Math.max(target.lastOccurrenceAt, entry.lastOccurrenceAt);
      }

      for (const [key, entry] of bucket.origin.entries()) {
      const target = this.getOrCreateOriginAggregate(aggregate.origin, key);
      target.count += entry.count;
      target.validationFailed += entry.validationFailed;
      target.payloadStripped += entry.payloadStripped;
      target.detailCount += entry.detailCount;
      target.requests += entry.requests;
      target.evaluations += entry.evaluations;
      }

      for (const [key, count] of bucket.requestCountsByRoute.entries()) {
        aggregate.requestCountsByRoute.set(key, (aggregate.requestCountsByRoute.get(key) || 0) + count);
      }
      for (const [key, count] of bucket.evaluationCountsByRoute.entries()) {
        aggregate.evaluationCountsByRoute.set(key, (aggregate.evaluationCountsByRoute.get(key) || 0) + count);
      }

      bucket.trackedValues.dto.forEach((value) => aggregate.trackedValues.dto.add(value));
      bucket.trackedValues.route.forEach((value) => aggregate.trackedValues.route.add(value));
      bucket.trackedValues.tenantHash.forEach((value) => aggregate.trackedValues.tenantHash.add(value));
      aggregate.overflowedEvents.dto += bucket.overflowedEvents.dto;
      aggregate.overflowedEvents.route += bucket.overflowedEvents.route;
      aggregate.overflowedEvents.tenantHash += bucket.overflowedEvents.tenantHash;
    }

    return aggregate;
  }

  private async loadBuckets(startMinute: number, endMinute: number): Promise<BucketsLoadResult> {
    const localBuckets = this.cloneLocalBuckets(startMinute, endMinute);
    if (!this.redisEnabled || !this.redis || this.shouldUseFallbackWithoutRetry()) {
      return {
        buckets: localBuckets,
        persistedWindowAvailable: false,
      };
    }

    try {
      if (this.shouldAttemptReconnect()) {
        await this.redis.connect();
      }

      if (this.redis.status !== 'ready') {
        throw new Error(`Redis status ${this.redis.status}`);
      }

      const minutes = this.listMinutesInRange(startMinute, endMinute);
      const pipeline = this.redis.multi();
      for (const minuteStartMs of minutes) {
        pipeline.hgetall(this.getRedisBucketKey(minuteStartMs));
      }

      const results = await pipeline.exec();
      const bucketByMinute = new Map<number, Map<string, ContractMinuteBucket>>();
      let persistedWindowAvailable = false;

      for (let index = 0; index < minutes.length; index += 1) {
        const rawFields = results?.[index]?.[1] as Record<string, string> | undefined;
        if (!rawFields || typeof rawFields !== 'object') {
          continue;
        }

        const instanceBuckets = new Map<string, ContractMinuteBucket>();
        for (const [instanceId, rawValue] of Object.entries(rawFields)) {
          const parsed = this.parsePersistedBucket(rawValue);
          if (!parsed) {
            continue;
          }
          instanceBuckets.set(instanceId, parsed);
        }

        if (instanceBuckets.size > 0) {
          persistedWindowAvailable = true;
          bucketByMinute.set(minutes[index], instanceBuckets);
        }
      }

      for (const [minuteStartMs, bucket] of localBuckets.entries()) {
        const instanceBuckets = bucketByMinute.get(minuteStartMs) || new Map<string, ContractMinuteBucket>();
        instanceBuckets.set(this.instanceId, bucket);
        bucketByMinute.set(minuteStartMs, instanceBuckets);
      }

      const mergedBuckets = new Map<number, ContractMinuteBucket>();
      for (const [minuteStartMs, instanceBuckets] of bucketByMinute.entries()) {
        const combined = this.createEmptyBucket(minuteStartMs);
        for (const bucket of instanceBuckets.values()) {
          this.mergeBucketInto(combined, bucket);
        }
        mergedBuckets.set(minuteStartMs, combined);
      }

      this.markRedisRecovered();
      return {
        buckets: mergedBuckets,
        persistedWindowAvailable,
      };
    } catch (error) {
      this.markRedisUnavailable(error instanceof Error ? error.message : String(error));
      return {
        buckets: localBuckets,
        persistedWindowAvailable: false,
      };
    }
  }

  private async persistDirtyBuckets(includeCurrentMinute: boolean): Promise<void> {
    if (!this.redisEnabled || !this.redis || this.shouldUseFallbackWithoutRetry()) {
      return;
    }

    if (this.flushPromise) {
      await this.flushPromise;
      return;
    }

    const currentMinute = this.toMinuteStart(Date.now());
    const dirtyMinutes = Array.from(this.pendingSyncBuckets)
      .filter((minuteStartMs) => includeCurrentMinute || minuteStartMs < currentMinute)
      .sort((left, right) => left - right);
    if (dirtyMinutes.length === 0) {
      return;
    }

    this.flushPromise = this.persistDirtyBucketsInternal(dirtyMinutes).finally(() => {
      this.flushPromise = null;
    });
    await this.flushPromise;
  }

  private async persistDirtyBucketsInternal(dirtyMinutes: number[]): Promise<void> {
    try {
      if (this.shouldAttemptReconnect()) {
        await this.redis!.connect();
      }

      if (this.redis!.status !== 'ready') {
        throw new Error(`Redis status ${this.redis!.status}`);
      }

      const ttlSeconds = Math.max(60, this.retentionMinutes * 60);
      const pipeline = this.redis!.multi();
      for (const minuteStartMs of dirtyMinutes) {
        const bucket = this.buckets.get(minuteStartMs);
        if (!bucket) {
          continue;
        }
        const key = this.getRedisBucketKey(minuteStartMs);
        pipeline.hset(key, this.instanceId, JSON.stringify(this.serializeBucket(bucket)));
        pipeline.expire(key, ttlSeconds);
      }

      await pipeline.exec();
      dirtyMinutes.forEach((minuteStartMs) => this.pendingSyncBuckets.delete(minuteStartMs));
      this.markRedisRecovered();
    } catch (error) {
      this.markRedisUnavailable(error instanceof Error ? error.message : String(error));
    }
  }

  private rotatePersistenceWindow(currentMinuteStartMs: number): void {
    this.pruneBuckets(currentMinuteStartMs);
    if (this.lastObservedMinuteStartMs === null) {
      this.lastObservedMinuteStartMs = currentMinuteStartMs;
      return;
    }

    if (currentMinuteStartMs !== this.lastObservedMinuteStartMs) {
      this.lastObservedMinuteStartMs = currentMinuteStartMs;
      void this.persistDirtyBuckets(false);
    }
  }

  private pruneBuckets(nowMs: number): void {
    const cutoffMinute = this.toMinuteStart(nowMs - this.retentionMinutes * 60_000);
    for (const minuteStartMs of Array.from(this.buckets.keys())) {
      if (minuteStartMs < cutoffMinute) {
        this.buckets.delete(minuteStartMs);
        this.pendingSyncBuckets.delete(minuteStartMs);
      }
    }
  }

  private cloneLocalBuckets(startMinute: number, endMinute: number): Map<number, ContractMinuteBucket> {
    const buckets = new Map<number, ContractMinuteBucket>();
    for (const minuteStartMs of this.listMinutesInRange(startMinute, endMinute)) {
      const bucket = this.buckets.get(minuteStartMs);
      if (!bucket) {
        continue;
      }
      buckets.set(minuteStartMs, this.cloneBucket(bucket));
    }
    return buckets;
  }

  private serializeBucket(bucket: ContractMinuteBucket): PersistedContractMinuteBucket {
    return {
      minuteStartMs: bucket.minuteStartMs,
      totalEvents: bucket.totalEvents,
      totalValidationErrors: bucket.totalValidationErrors,
      totalPayloadStrips: bucket.totalPayloadStrips,
      totalDetails: bucket.totalDetails,
      totalEvaluations: bucket.totalEvaluations,
      wsEvaluations: bucket.wsEvaluations,
      httpRequests: bucket.httpRequests,
      distribution: Array.from(bucket.distribution.entries()),
      dto: Array.from(bucket.dto.entries()).map(([key, value]) => [
        key,
        {
          ...value,
          routes: Array.from(value.routes.entries()),
        },
      ]),
      route: Array.from(bucket.route.entries()),
      tenant: Array.from(bucket.tenant.entries()),
      origin: Array.from(bucket.origin.entries()),
      requestCountsByRoute: Array.from(bucket.requestCountsByRoute.entries()),
      evaluationCountsByRoute: Array.from(bucket.evaluationCountsByRoute.entries()),
      trackedValues: {
        dto: Array.from(bucket.trackedValues.dto.values()),
        route: Array.from(bucket.trackedValues.route.values()),
        tenantHash: Array.from(bucket.trackedValues.tenantHash.values()),
      },
      overflowedEvents: {
        dto: bucket.overflowedEvents.dto,
        route: bucket.overflowedEvents.route,
        tenantHash: bucket.overflowedEvents.tenantHash,
      },
    };
  }

  private parsePersistedBucket(rawValue: string): ContractMinuteBucket | null {
    try {
      const parsed = JSON.parse(rawValue) as PersistedContractMinuteBucket;
      const bucket = this.createEmptyBucket(parsed.minuteStartMs);
      bucket.totalEvents = parsed.totalEvents || 0;
      bucket.totalValidationErrors = parsed.totalValidationErrors || 0;
      bucket.totalPayloadStrips = parsed.totalPayloadStrips || 0;
      bucket.totalDetails = parsed.totalDetails || 0;
      bucket.totalEvaluations = parsed.totalEvaluations || 0;
      bucket.wsEvaluations = parsed.wsEvaluations || 0;
      bucket.httpRequests = parsed.httpRequests || 0;
      bucket.distribution = new Map(parsed.distribution || []);
      bucket.dto = new Map(
        (parsed.dto || []).map(([key, value]) => [
          key,
          {
            ...value,
            routes: new Map(value.routes || []),
          },
        ]),
      );
      bucket.route = new Map(parsed.route || []);
      bucket.tenant = new Map(parsed.tenant || []);
      bucket.origin = new Map(
        (parsed.origin || []).map(([key, value]) => [
          key,
          {
            ...value,
            requests: value.requests || 0,
            evaluations: value.evaluations || 0,
          },
        ]),
      );
      bucket.requestCountsByRoute = new Map(parsed.requestCountsByRoute || []);
      bucket.evaluationCountsByRoute = new Map(parsed.evaluationCountsByRoute || []);
      bucket.trackedValues = {
        dto: new Set(parsed.trackedValues?.dto || []),
        route: new Set(parsed.trackedValues?.route || []),
        tenantHash: new Set(parsed.trackedValues?.tenantHash || []),
      };
      bucket.overflowedEvents = {
        dto: parsed.overflowedEvents?.dto || 0,
        route: parsed.overflowedEvents?.route || 0,
        tenantHash: parsed.overflowedEvents?.tenantHash || 0,
      };
      return bucket;
    } catch {
      return null;
    }
  }

  private getRedisBucketKey(minuteStartMs: number): string {
    return `${this.redisPrefix}:bucket:${minuteStartMs}`;
  }

  private getOrCreateBucket(minuteStartMs: number): ContractMinuteBucket {
    let bucket = this.buckets.get(minuteStartMs);
    if (!bucket) {
      bucket = this.createEmptyBucket(minuteStartMs);
      this.buckets.set(minuteStartMs, bucket);
    }
    return bucket;
  }

  private createEmptyBucket(minuteStartMs: number): ContractMinuteBucket {
    return {
      minuteStartMs,
      totalEvents: 0,
      totalValidationErrors: 0,
      totalPayloadStrips: 0,
      totalDetails: 0,
      totalEvaluations: 0,
      wsEvaluations: 0,
      httpRequests: 0,
      distribution: new Map(),
      dto: new Map(),
      route: new Map(),
      tenant: new Map(),
      origin: new Map(),
      requestCountsByRoute: new Map(),
      evaluationCountsByRoute: new Map(),
      trackedValues: {
        dto: new Set(),
        route: new Set(),
        tenantHash: new Set(),
      },
      overflowedEvents: {
        dto: 0,
        route: 0,
        tenantHash: 0,
      },
    };
  }

  private cloneBucket(bucket: ContractMinuteBucket): ContractMinuteBucket {
    return (
      this.parsePersistedBucket(JSON.stringify(this.serializeBucket(bucket))) ||
      this.createEmptyBucket(bucket.minuteStartMs)
    );
  }

  private mergeBucketInto(target: ContractMinuteBucket, source: ContractMinuteBucket): void {
    target.totalEvents += source.totalEvents;
    target.totalValidationErrors += source.totalValidationErrors;
    target.totalPayloadStrips += source.totalPayloadStrips;
    target.totalDetails += source.totalDetails;
    target.totalEvaluations += source.totalEvaluations;
    target.wsEvaluations += source.wsEvaluations;
    target.httpRequests += source.httpRequests;

    for (const [key, entry] of source.distribution.entries()) {
      const distribution = this.getOrCreateDistributionAggregate(target.distribution, key, entry.dto, entry.type);
      distribution.count += entry.count;
      distribution.detailCount += entry.detailCount;
      distribution.lastOccurrenceAt = Math.max(distribution.lastOccurrenceAt, entry.lastOccurrenceAt);
    }

    for (const [key, entry] of source.dto.entries()) {
      const dto = this.getOrCreateDtoAggregate(target.dto, key);
      dto.count += entry.count;
      dto.validationFailed += entry.validationFailed;
      dto.payloadStripped += entry.payloadStripped;
      dto.detailCount += entry.detailCount;
      dto.lastOccurrenceAt = Math.max(dto.lastOccurrenceAt, entry.lastOccurrenceAt);
      for (const [route, count] of entry.routes.entries()) {
        dto.routes.set(route, (dto.routes.get(route) || 0) + count);
      }
    }

    for (const [key, entry] of source.route.entries()) {
      const route = this.getOrCreateRouteAggregate(
        target.route,
        key,
        entry.route,
        entry.method,
        entry.module,
        entry.origin,
        entry.operationType,
      );
      route.count += entry.count;
      route.validationFailed += entry.validationFailed;
      route.payloadStripped += entry.payloadStripped;
      route.detailCount += entry.detailCount;
      route.lastOccurrenceAt = Math.max(route.lastOccurrenceAt, entry.lastOccurrenceAt);
      route.module = this.mergeNullableLabel(route.module, entry.module);
    }

    for (const [key, entry] of source.tenant.entries()) {
      const tenant = this.getOrCreateTenantAggregate(target.tenant, key);
      tenant.count += entry.count;
      tenant.validationFailed += entry.validationFailed;
      tenant.payloadStripped += entry.payloadStripped;
      tenant.detailCount += entry.detailCount;
      tenant.lastOccurrenceAt = Math.max(tenant.lastOccurrenceAt, entry.lastOccurrenceAt);
    }

    for (const [key, entry] of source.origin.entries()) {
      const origin = this.getOrCreateOriginAggregate(target.origin, key);
      origin.count += entry.count;
      origin.validationFailed += entry.validationFailed;
      origin.payloadStripped += entry.payloadStripped;
      origin.detailCount += entry.detailCount;
      origin.requests += entry.requests;
      origin.evaluations += entry.evaluations;
    }

    for (const [key, count] of source.requestCountsByRoute.entries()) {
      target.requestCountsByRoute.set(key, (target.requestCountsByRoute.get(key) || 0) + count);
    }
    for (const [key, count] of source.evaluationCountsByRoute.entries()) {
      target.evaluationCountsByRoute.set(key, (target.evaluationCountsByRoute.get(key) || 0) + count);
    }

    source.trackedValues.dto.forEach((value) => target.trackedValues.dto.add(value));
    source.trackedValues.route.forEach((value) => target.trackedValues.route.add(value));
    source.trackedValues.tenantHash.forEach((value) => target.trackedValues.tenantHash.add(value));
    target.overflowedEvents.dto += source.overflowedEvents.dto;
    target.overflowedEvents.route += source.overflowedEvents.route;
    target.overflowedEvents.tenantHash += source.overflowedEvents.tenantHash;
  }

  private getOrCreateDistributionAggregate(
    source: Map<string, ContractDistributionAggregate>,
    key: string,
    dto: string,
    type: 'payload_stripped' | 'validation_failed',
  ): ContractDistributionAggregate {
    let aggregate = source.get(key);
    if (!aggregate) {
      aggregate = {
        dto,
        type,
        count: 0,
        detailCount: 0,
        lastOccurrenceAt: 0,
      };
      source.set(key, aggregate);
    }
    return aggregate;
  }

  private getOrCreateDtoAggregate(source: Map<string, ContractDtoAggregate>, dto: string): ContractDtoAggregate {
    let aggregate = source.get(dto);
    if (!aggregate) {
      aggregate = {
        dto,
        count: 0,
        validationFailed: 0,
        payloadStripped: 0,
        detailCount: 0,
        lastOccurrenceAt: 0,
        routes: new Map(),
      };
      source.set(dto, aggregate);
    }
    return aggregate;
  }

  private getOrCreateRouteAggregate(
    source: Map<string, ContractRouteAggregate>,
    key: string,
    route: string,
    method: string | null,
    module: string | null,
    origin: ContractEventOrigin,
    operationType: ContractOperationType | null,
  ): ContractRouteAggregate {
    let aggregate = source.get(key);
    if (!aggregate) {
      aggregate = {
        route,
        method,
        module,
        origin,
        operationType,
        count: 0,
        validationFailed: 0,
        payloadStripped: 0,
        detailCount: 0,
        lastOccurrenceAt: 0,
      };
      source.set(key, aggregate);
    }
    return aggregate;
  }

  private getOrCreateTenantAggregate(
    source: Map<string, ContractTenantAggregate>,
    tenantHash: string,
  ): ContractTenantAggregate {
    let aggregate = source.get(tenantHash);
    if (!aggregate) {
      aggregate = {
        tenantHash,
        count: 0,
        validationFailed: 0,
        payloadStripped: 0,
        detailCount: 0,
        lastOccurrenceAt: 0,
      };
      source.set(tenantHash, aggregate);
    }
    return aggregate;
  }

  private getOrCreateOriginAggregate(
    source: Map<ContractEventOrigin, ContractOriginAggregate>,
    origin: ContractEventOrigin,
  ): ContractOriginAggregate {
    let aggregate = source.get(origin);
    if (!aggregate) {
      aggregate = {
        origin,
        count: 0,
        validationFailed: 0,
        payloadStripped: 0,
        detailCount: 0,
        requests: 0,
        evaluations: 0,
      };
      source.set(origin, aggregate);
    }
    return aggregate;
  }

  private buildRouteAggregateKey(
    route: string,
    method: string | null,
    origin: ContractEventOrigin,
    operationType: ContractOperationType | null,
  ): string {
    return `${origin}|${method || '-'}|${operationType || '-'}|${route}`;
  }

  private bucketDimension(
    trackedValues: Set<string>,
    limit: number,
    rawValue: string,
    overflowValue: string,
    onOverflow: () => void,
  ): string {
    const normalized = rawValue.trim();
    if (trackedValues.has(normalized)) {
      return normalized;
    }
    if (trackedValues.size < limit) {
      trackedValues.add(normalized);
      return normalized;
    }
    onOverflow();
    return overflowValue;
  }

  private normalizeOrigin(origin: ContractEventOrigin | undefined): ContractEventOrigin {
    if (origin === 'http' || origin === 'ws' || origin === 'system') {
      return origin;
    }
    return 'system';
  }

  private normalizeMethod(method: string | null | undefined, origin: ContractEventOrigin): string | null {
    if (origin === 'ws') {
      return 'WS';
    }
    if (typeof method !== 'string' || method.trim().length === 0) {
      return origin === 'system' ? null : 'GET';
    }
    return normalizeTelemetryMethod(method);
  }

  private normalizeRoute(route: string | null | undefined, origin: ContractEventOrigin): string {
    if (typeof route === 'string' && route.trim().length > 0) {
      return normalizeTelemetryPath(route);
    }
    if (origin === 'ws') {
      return '/ws/unknown';
    }
    if (origin === 'system') {
      return '/system/unknown';
    }
    return '/api/unknown';
  }

  private normalizeModule(moduleName: string | null | undefined): string | null {
    if (typeof moduleName !== 'string') {
      return null;
    }
    const normalized = moduleName.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeTenant(tenantHash: string | null | undefined): string {
    if (typeof tenantHash !== 'string') {
      return 'unknown';
    }
    const normalized = tenantHash.trim();
    return normalized.length > 0 ? normalized : 'unknown';
  }

  private normalizeOperationType(
    operationType: ContractOperationType | null | undefined,
    method?: string | null,
    origin?: ContractEventOrigin,
  ): ContractOperationType {
    const resolved =
      operationType ||
      (method && origin ? resolveContractOperationType(method, origin) : 'unknown');
    switch (resolved) {
      case 'read':
      case 'create':
      case 'update':
      case 'delete':
      case 'emit':
      case 'command':
        return resolved;
      default:
        return 'other';
    }
  }

  private normalizeDetailCount(value: number): number {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : 1;
  }

  private normalizeTimestamp(value: unknown): number {
    if (value instanceof Date) {
      return value.getTime();
    }
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : Date.now();
  }

  private normalizeWindowMs(value: number, fallback: number): number {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 60_000 ? Math.floor(normalized) : fallback;
  }

  private toMinuteStart(timestamp: number): number {
    return Math.floor(timestamp / 60_000) * 60_000;
  }

  private resolveWindowEndMinute(currentMinute: number): number {
    if (this.buckets.has(currentMinute)) {
      return currentMinute;
    }

    const localMinutes = Array.from(this.buckets.keys()).filter((minuteStartMs) => minuteStartMs <= currentMinute);
    if (localMinutes.length === 0) {
      return currentMinute;
    }

    return Math.max(...localMinutes);
  }

  private countMinutesInRange(startMinute: number, endMinute: number): number {
    if (endMinute < startMinute) {
      return 0;
    }
    return Math.floor((endMinute - startMinute) / 60_000) + 1;
  }

  private listMinutesInRange(startMinute: number, endMinute: number): number[] {
    if (endMinute < startMinute) {
      return [];
    }
    const minutes: number[] = [];
    for (let cursor = startMinute; cursor <= endMinute; cursor += 60_000) {
      minutes.push(cursor);
    }
    return minutes;
  }

  private findTopRoute(routes: Map<string, number>): string | null {
    const entries = Array.from(routes.entries()).sort((left, right) => {
      return right[1] - left[1] || left[0].localeCompare(right[0]);
    });
    return entries[0]?.[0] || null;
  }

  private computeRatePerThousand(count: number, total: number): number | null {
    if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) {
      return null;
    }
    return Number(((count / total) * 1000).toFixed(2));
  }

  private computePercentageChange(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return null;
    }
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private maxSeverity(left: ContractMetricSeverity, right: ContractMetricSeverity): ContractMetricSeverity {
    const rank: Record<ContractMetricSeverity, number> = {
      normal: 0,
      warning: 1,
      critical: 2,
    };
    return rank[left] >= rank[right] ? left : right;
  }

  private mergeNullableLabel(current: string | null, next: string | null): string | null {
    if (!current) {
      return next;
    }
    if (!next || current === next) {
      return current;
    }
    return 'mixed';
  }

  private quantile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * percentile));
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
      return sorted[lower];
    }
    const weight = position - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private roundMetric(value: number): number {
    return Number(Number(value || 0).toFixed(2));
  }

  private markBucketDirty(minuteStartMs: number): void {
    this.pendingSyncBuckets.add(minuteStartMs);
  }

  private shouldAttemptReconnect(): boolean {
    return Date.now() >= this.redisRetryAvailableAt;
  }

  private shouldUseFallbackWithoutRetry(): boolean {
    return !this.redis || (this.redisFallbackActive && !this.shouldAttemptReconnect());
  }

  private markRedisUnavailable(detail: string): void {
    this.redisFallbackActive = true;
    this.redisHealthy = false;
    this.redisRetryAvailableAt = Date.now() + this.redisRetryCooldownMs;
    this.lastRedisError = detail;
  }

  private markRedisRecovered(): void {
    this.redisFallbackActive = false;
    this.redisHealthy = true;
    this.redisRetryAvailableAt = 0;
    this.lastRedisError = null;
  }

  private readEnvNumber(name: string, fallback: number, min: number, max: number): number {
    const rawValue = Number(process.env[name]);
    if (!Number.isFinite(rawValue)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(rawValue)));
  }
}
