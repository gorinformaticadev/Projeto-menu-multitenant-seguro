import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  ContractEventOrigin,
  ContractMetricSeverity,
  ContractObservabilityThresholds,
  ContractOperationType,
  ContractPayloadStrippedEvent,
  ContractValidationFailedEvent,
} from './contract-observability.types';
import {
  maskTelemetryIp,
  normalizeTelemetryMethod,
  normalizeTelemetryPath,
  resolveContractOperationType,
  resolveTelemetryClientIp,
  resolveTelemetryModule,
  resolveTelemetryRoute,
  shouldCollectRequestTelemetry,
  shouldCollectSecurityTelemetry,
} from './system-telemetry.util';

export type SecurityTelemetryEventType =
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'maintenance_blocked'
  | 'maintenance_bypass_attempt';

export type ContractAnomalyType = 'payload_stripped' | 'validation_failed';

export interface ContractAnomalyRecord {
  at: number;
  type: ContractAnomalyType;
  dto: string;
  route: string | null;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  tenantHash: string | null;
  operationType: ContractOperationType;
  detailCount: number;
}

export interface ContractAnomalySummary {
  dto: string;
  type: ContractAnomalyType;
  count: number;
  detailCount: number;
  lastOccurrenceMs: number;
}

export interface ContractAnomalyDtoSummary {
  dto: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: string;
  topRoute: string | null;
}

export interface ContractAnomalyMinuteSummary {
  minuteStart: string;
  total: number;
  validationFailed: number;
  payloadStripped: number;
}

export interface ContractAnomalyRouteSummary {
  route: string;
  method: string | null;
  module: string | null;
  origin: ContractEventOrigin;
  operationType: ContractOperationType | null;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  requests: number;
  failureRatePerThousandRequests: number | null;
  strippingRatePerThousandRequests: number | null;
  totalRatePerThousandRequests: number | null;
  lastOccurrenceAt: string;
}

export interface ContractAnomalyTenantSummary {
  tenantHash: string;
  count: number;
  validationFailed: number;
  payloadStripped: number;
  detailCount: number;
  lastOccurrenceAt: string;
}

export interface ContractTrendSnapshot {
  previousWindowStart: string;
  previousWindowSeconds: number;
  previousTotalEvents: number;
  previousValidationErrors: number;
  previousPayloadStrips: number;
  totalIncreasePercent: number | null;
  validationIncreasePercent: number | null;
  payloadIncreasePercent: number | null;
  lastBucketIncreasePercent: number | null;
  continuousGrowthMinutes: number;
  continuousGrowthBuckets: number;
  increasingForLastHour: boolean;
}

export interface ContractSeveritySnapshot {
  validationFailed: ContractMetricSeverity;
  payloadStripped: ContractMetricSeverity;
  trend: ContractMetricSeverity;
  overall: ContractMetricSeverity;
}

export interface ContractAnomalySnapshot {
  status: 'ok';
  windowStart: string;
  windowSeconds: number;
  requestsInWindow: number;
  totalEvents: number;
  totalValidationErrors: number;
  totalPayloadStrips: number;
  totalDetails: number;
  eventsPerMinuteAvg: number;
  failureRatePerThousandRequests: number | null;
  strippingRatePerThousandRequests: number | null;
  distribution: ContractAnomalySummary[];
  byDto: ContractAnomalyDtoSummary[];
  byRoute: ContractAnomalyRouteSummary[];
  byTenant: ContractAnomalyTenantSummary[];
  eventsPerMinute: ContractAnomalyMinuteSummary[];
  thresholds: ContractObservabilityThresholds;
  trends: ContractTrendSnapshot;
  severity: ContractSeveritySnapshot;
}

export interface RouteTelemetrySummary {
  route: string;
  method: string;
  requestCount: number;
  avgMs: number | null;
  p95Ms: number | null;
  errorCount: number;
  errorRate: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  lastErrorAt: string | null;
}

export interface SecurityTelemetryIpSummary {
  ip: string;
  count: number;
  lastSeenAt: string;
  route: string | null;
}

export interface SecurityTelemetryRecentEvent {
  type: SecurityTelemetryEventType;
  statusCode: number;
  method: string;
  route: string;
  ip: string;
  at: string;
}

export interface ApiTelemetrySnapshot {
  status: 'ok';
  windowStart: string;
  windowSeconds: number;
  totalRequestsRecent: number;
  totalErrorCount: number;
  total5xxCount: number;
  avgResponseMs: number | null;
  errorRateRecent: number;
  error5xxRateRecent: number;
  topSlowRoutes: RouteTelemetrySummary[];
  topErrorRoutes: RouteTelemetrySummary[];
}

export interface SecurityTelemetrySnapshot {
  status: 'ok';
  windowStart: string;
  windowSeconds: number;
  maintenanceBypassAttemptsRecent: number;
  unauthorizedCountRecent: number;
  forbiddenCountRecent: number;
  rateLimitedCountRecent: number;
  deniedSpikeCountRecent: number;
  topDeniedIps: SecurityTelemetryIpSummary[];
  topRateLimitedIps: SecurityTelemetryIpSummary[];
  accessDeniedRecent: SecurityTelemetryRecentEvent[];
  routeDistribution: Array<{
    route: string;
    count: number;
  }>;
  deniedAccess: SecurityTelemetryIpSummary[];
}

type RequestTelemetryRecord = {
  at: number;
  method: string;
  route: string;
  durationMs: number;
  statusCode: number;
};

type SecurityTelemetryRecord = {
  at: number;
  type: SecurityTelemetryEventType;
  method: string;
  route: string;
  ip: string;
  statusCode: number;
};

type RouteAggregate = {
  route: string;
  method: string;
  requestCount: number;
  totalDurationMs: number;
  durationsMs: number[];
  errorCount: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  lastErrorAt: number | null;
};

type SecurityAggregate = {
  count: number;
  lastSeenAt: number;
  route: string | null;
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

type ContractEventMinuteAggregate = {
  total: number;
  validationFailed: number;
  payloadStripped: number;
};

type ContractSnapshotOptions = {
  topLimit?: number;
  thresholds?: ContractObservabilityThresholds;
};

const REQUEST_RETENTION_MS = 30 * 60 * 1000;
const DEFAULT_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_MAX_ENTRIES = 5_000;
const SECURITY_RETENTION_MS = 6 * 60 * 60 * 1000;
const SECURITY_MAX_ENTRIES = 2_000;
const DEFAULT_TOP_LIMIT = 5;
const RECENT_SECURITY_LIMIT = 20;
const MIN_REQUESTS_FOR_ROUTE_TOP_LIST = 3;
const MIN_ERRORS_FOR_ROUTE_ERROR_LIST = 2;
const CONTRACT_RETENTION_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CONTRACT_WINDOW_MS = 10 * 60 * 1000;
const CONTRACT_MAX_ENTRIES = 10_000;
const DEFAULT_CONTRACT_TOP_LIMIT = 10;
const CONTRACT_TREND_LOOKBACK_MINUTES = 60;

const DEFAULT_CONTRACT_THRESHOLDS: ContractObservabilityThresholds = {
  validationFailed: {
    volume: {
      warning: 3,
      critical: 8,
    },
    ratePerThousandRequests: {
      warning: 2,
      critical: 5,
    },
  },
  payloadStripped: {
    volume: {
      warning: 5,
      critical: 12,
    },
    ratePerThousandRequests: {
      warning: 5,
      critical: 15,
    },
  },
  trend: {
    warningPercent: 100,
    criticalPercent: 200,
    bucketMinutes: 10,
    warningGrowthMinutes: 30,
    criticalGrowthMinutes: 60,
    minEventCount: 4,
  },
};

@Injectable()
export class SystemTelemetryService {
  private readonly requestEvents: RequestTelemetryRecord[] = [];
  private readonly securityEvents: SecurityTelemetryRecord[] = [];
  private readonly contractEvents: ContractAnomalyRecord[] = [];

  recordRequest(input: {
    method?: unknown;
    route?: unknown;
    request?: Record<string, any>;
    durationMs: number;
    statusCode: number;
  }): void {
    const durationMs = Number(input.durationMs);
    const statusCode = this.normalizeStatusCode(input.statusCode);
    const method = normalizeTelemetryMethod(input.method || input.request?.method);
    const route = normalizeTelemetryPath(
      input.route || (input.request ? resolveTelemetryRoute(input.request) : '/'),
    );

    if (!Number.isFinite(durationMs) || durationMs < 0 || !shouldCollectRequestTelemetry(method, route)) {
      return;
    }

    this.pruneRequestEvents();
    const lastAt =
      this.requestEvents.length > 0 ? this.requestEvents[this.requestEvents.length - 1].at : undefined;

    this.requestEvents.push({
      at: this.toMonotonicTimestamp(Date.now(), lastAt),
      method,
      route,
      durationMs: Number(durationMs.toFixed(2)),
      statusCode,
    });

    this.trimRequestEvents();
  }

  recordSecurityEvent(input: {
    type: SecurityTelemetryEventType;
    method?: unknown;
    route?: unknown;
    request?: Record<string, any>;
    ip?: unknown;
    statusCode: number;
  }): void {
    const method = normalizeTelemetryMethod(input.method || input.request?.method);
    const route = normalizeTelemetryPath(
      input.route || (input.request ? resolveTelemetryRoute(input.request) : '/'),
    );
    if (!shouldCollectSecurityTelemetry(method, route)) {
      return;
    }

    const ip = String(input.ip || resolveTelemetryClientIp(input.request || {})).trim() || 'unknown';
    const statusCode = this.normalizeStatusCode(input.statusCode);

    this.pruneSecurityEvents();
    const lastAt =
      this.securityEvents.length > 0 ? this.securityEvents[this.securityEvents.length - 1].at : undefined;

    this.securityEvents.push({
      at: this.toMonotonicTimestamp(Date.now(), lastAt),
      type: input.type,
      method,
      route,
      ip,
      statusCode,
    });

    this.trimSecurityEvents();
  }

  @OnEvent('contract.validation.failed')
  handleContractValidationFailed(payload: ContractValidationFailedEvent): void {
    this.recordContractAnomaly({
      type: 'validation_failed',
      dto: payload.dto,
      route: payload.route,
      method: payload.method,
      module: payload.module,
      origin: payload.origin,
      tenantHash: payload.tenantHash,
      operationType: payload.operationType,
      detailCount: payload.errorCount,
      at: this.toEventTimestamp(payload.timestamp),
    });
  }

  @OnEvent('contract.payload.stripped')
  handleContractPayloadStripped(payload: ContractPayloadStrippedEvent): void {
    this.recordContractAnomaly({
      type: 'payload_stripped',
      dto: payload.dto,
      route: payload.route,
      method: payload.method,
      module: payload.module,
      origin: payload.origin,
      tenantHash: payload.tenantHash,
      operationType: payload.operationType,
      detailCount: payload.strippedFieldCount || payload.strippedFields?.length || 1,
      at: this.toEventTimestamp(payload.timestamp),
    });
  }

  getApiSnapshot(windowMs = DEFAULT_REQUEST_WINDOW_MS, topLimit = DEFAULT_TOP_LIMIT): ApiTelemetrySnapshot {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, DEFAULT_REQUEST_WINDOW_MS);
    const cutoff = Date.now() - normalizedWindowMs;
    this.pruneRequestEvents();

    const relevant = this.requestEvents.filter((event) => event.at >= cutoff);
    const aggregates = this.aggregateRoutes(relevant);
    const summaries = Array.from(aggregates.values()).map((entry) => this.toRouteSummary(entry));

    const totalRequestsRecent = summaries.reduce((total, entry) => total + entry.requestCount, 0);
    const totalErrorCount = summaries.reduce((total, entry) => total + entry.errorCount, 0);
    const total5xxCount = summaries.reduce((total, entry) => total + entry.status5xx, 0);
    const totalDurationMs = relevant.reduce((total, entry) => total + entry.durationMs, 0);
    const avgResponseMs =
      totalRequestsRecent > 0 ? Number((totalDurationMs / totalRequestsRecent).toFixed(2)) : null;

    return {
      status: 'ok',
      windowStart: new Date(cutoff).toISOString(),
      windowSeconds: Math.floor(normalizedWindowMs / 1000),
      totalRequestsRecent,
      totalErrorCount,
      total5xxCount,
      avgResponseMs,
      errorRateRecent: this.computeRate(totalErrorCount, totalRequestsRecent),
      error5xxRateRecent: this.computeRate(total5xxCount, totalRequestsRecent),
      topSlowRoutes: summaries
        .filter((entry) => this.isEligibleForTopSlowRoutes(entry))
        .sort((left, right) => {
          const rightLatency = right.avgMs ?? -1;
          const leftLatency = left.avgMs ?? -1;
          return (
            rightLatency - leftLatency ||
            (right.p95Ms ?? -1) - (left.p95Ms ?? -1) ||
            right.errorCount - left.errorCount ||
            right.requestCount - left.requestCount
          );
        })
        .slice(0, Math.max(1, topLimit)),
      topErrorRoutes: summaries
        .filter((entry) => this.isEligibleForTopErrorRoutes(entry))
        .sort((left, right) => {
          return (
            right.errorCount - left.errorCount ||
            right.errorRate - left.errorRate ||
            (right.lastErrorAt || '').localeCompare(left.lastErrorAt || '') ||
            right.requestCount - left.requestCount
          );
        })
        .slice(0, Math.max(1, topLimit)),
    };
  }

  getSecuritySnapshot(
    windowMs = SECURITY_RETENTION_MS,
    topLimit = DEFAULT_TOP_LIMIT,
  ): SecurityTelemetrySnapshot {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, SECURITY_RETENTION_MS);
    const cutoff = Date.now() - normalizedWindowMs;
    this.pruneSecurityEvents();

    const relevant = this.securityEvents.filter((event) => event.at >= cutoff);
    const deniedIps = new Map<string, SecurityAggregate>();
    const rateLimitedIps = new Map<string, SecurityAggregate>();
    const routeDistribution = new Map<string, number>();
    let unauthorizedCountRecent = 0;
    let forbiddenCountRecent = 0;
    let rateLimitedCountRecent = 0;

    for (const event of relevant) {
      routeDistribution.set(event.route, (routeDistribution.get(event.route) || 0) + 1);

      if (event.statusCode === 429 || event.type === 'rate_limited') {
        rateLimitedCountRecent += 1;
        this.bumpSecurityAggregate(rateLimitedIps, event.ip, event.route, event.at);
        continue;
      }

      if (event.statusCode === 401 || event.type === 'unauthorized') {
        unauthorizedCountRecent += 1;
      }

      if (
        event.statusCode === 403 ||
        event.statusCode === 503 ||
        event.type === 'forbidden' ||
        event.type === 'maintenance_blocked' ||
        event.type === 'maintenance_bypass_attempt'
      ) {
        forbiddenCountRecent += 1;
      }

      if (event.statusCode === 401 || event.statusCode === 403 || event.statusCode === 503) {
        this.bumpSecurityAggregate(deniedIps, event.ip, event.route, event.at);
      }
    }

    const deniedSpikeCountRecent = unauthorizedCountRecent + forbiddenCountRecent + rateLimitedCountRecent;

    return {
      status: 'ok',
      windowStart: new Date(cutoff).toISOString(),
      windowSeconds: Math.floor(normalizedWindowMs / 1000),
      maintenanceBypassAttemptsRecent: relevant.filter(
        (event) => event.type === 'maintenance_bypass_attempt',
      ).length,
      unauthorizedCountRecent,
      forbiddenCountRecent,
      rateLimitedCountRecent,
      deniedSpikeCountRecent,
      topDeniedIps: this.mapSecurityAggregate(deniedIps, topLimit),
      topRateLimitedIps: this.mapSecurityAggregate(rateLimitedIps, topLimit),
      accessDeniedRecent: relevant
        .slice(-RECENT_SECURITY_LIMIT)
        .reverse()
        .map((event) => ({
          type: event.type,
          statusCode: event.statusCode,
          method: event.method,
          route: event.route,
          ip: event.ip,
          at: new Date(event.at).toISOString(),
        })),
      routeDistribution: Array.from(routeDistribution.entries())
        .map(([route, count]) => ({ route, count }))
        .sort((left, right) => right.count - left.count || left.route.localeCompare(right.route))
        .slice(0, Math.max(1, topLimit)),
      deniedAccess: this.mapSecurityAggregate(deniedIps, topLimit),
    };
  }

  recordContractAnomaly(type: ContractAnomalyType, dto: string): void;
  recordContractAnomaly(
    input: Partial<ContractAnomalyRecord> & Pick<ContractAnomalyRecord, 'type' | 'dto'>,
  ): void;
  recordContractAnomaly(
    typeOrInput:
      | ContractAnomalyType
      | (Partial<ContractAnomalyRecord> & Pick<ContractAnomalyRecord, 'type' | 'dto'>),
    dto?: string,
  ): void {
    const input =
      typeof typeOrInput === 'string'
        ? {
            type: typeOrInput,
            dto: String(dto || '').trim() || 'UnknownDto',
          }
        : typeOrInput;

    this.pruneContractEvents();
    const lastAt =
      this.contractEvents.length > 0 ? this.contractEvents[this.contractEvents.length - 1].at : undefined;
    const at = this.toMonotonicTimestamp(
      this.toEventTimestamp(input.at) ?? Date.now(),
      lastAt,
    );
    const origin = this.normalizeContractOrigin(input.origin);
    const route = this.normalizeContractRoute(input.route, origin);
    const method = this.normalizeContractMethod(input.method, origin);
    const moduleName = this.normalizeContractModule(input.module, route);
    const operationType = this.normalizeContractOperationType(input.operationType, method, origin);
    const detailCount = this.normalizeDetailCount(input.detailCount);

    this.contractEvents.push({
      at,
      type: input.type,
      dto: String(input.dto || '').trim() || 'UnknownDto',
      route,
      method,
      module: moduleName,
      origin,
      tenantHash:
        typeof input.tenantHash === 'string' && input.tenantHash.trim().length > 0
          ? input.tenantHash.trim()
          : null,
      operationType,
      detailCount,
    });

    this.trimContractEvents();
  }

  getContractAnomalySnapshot(
    windowMs = DEFAULT_CONTRACT_WINDOW_MS,
    options: ContractSnapshotOptions = {},
  ): ContractAnomalySnapshot {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, DEFAULT_CONTRACT_WINDOW_MS);
    const topLimit = Math.max(1, Number(options.topLimit || DEFAULT_CONTRACT_TOP_LIMIT));
    const thresholds = options.thresholds || DEFAULT_CONTRACT_THRESHOLDS;
    const nowMs = Date.now();
    const cutoff = nowMs - normalizedWindowMs;
    const previousCutoff = cutoff - normalizedWindowMs;

    this.pruneContractEvents();
    this.pruneRequestEvents();

    const relevant = this.contractEvents.filter((event) => event.at >= cutoff);
    const previousRelevant = this.contractEvents.filter(
      (event) => event.at >= previousCutoff && event.at < cutoff,
    );
    const requestCountsByRoute = this.countRequestsByRoute(cutoff, nowMs);
    const requestsInWindow = this.countRequestsInWindow(cutoff, nowMs);

    const currentAggregates = this.aggregateContractEvents(relevant, requestCountsByRoute, topLimit);
    const previousAggregates = this.aggregateContractEvents(previousRelevant, new Map(), topLimit);
    const bucketMinutes = Math.max(1, thresholds.trend.bucketMinutes);
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketCount = Math.max(1, Math.floor(CONTRACT_TREND_LOOKBACK_MINUTES / bucketMinutes));
    const trendBuckets = this.buildContractTrendBuckets(bucketMs, bucketCount, nowMs);
    const lastBucketIncreasePercent = this.computePercentageChange(
      trendBuckets[trendBuckets.length - 1] || 0,
      trendBuckets.length > 1 ? trendBuckets[trendBuckets.length - 2] : 0,
    );
    const continuousGrowthBuckets = this.resolveContinuousGrowthBuckets(trendBuckets);
    const continuousGrowthMinutes = continuousGrowthBuckets * bucketMinutes;
    const increasingForLastHour =
      continuousGrowthBuckets >= bucketCount &&
      trendBuckets.reduce((total, value) => total + value, 0) >= thresholds.trend.minEventCount;
    const failureRatePerThousandRequests = this.computeRatePerThousand(
      currentAggregates.totalValidationErrors,
      requestsInWindow,
    );
    const strippingRatePerThousandRequests = this.computeRatePerThousand(
      currentAggregates.totalPayloadStrips,
      requestsInWindow,
    );
    const severity = this.resolveContractSeverity(
      {
        totalValidationErrors: currentAggregates.totalValidationErrors,
        totalPayloadStrips: currentAggregates.totalPayloadStrips,
        failureRatePerThousandRequests,
        strippingRatePerThousandRequests,
        totalEvents: currentAggregates.totalEvents,
      },
      {
        totalIncreasePercent: this.computePercentageChange(
          currentAggregates.totalEvents,
          previousAggregates.totalEvents,
        ),
        validationIncreasePercent: this.computePercentageChange(
          currentAggregates.totalValidationErrors,
          previousAggregates.totalValidationErrors,
        ),
        payloadIncreasePercent: this.computePercentageChange(
          currentAggregates.totalPayloadStrips,
          previousAggregates.totalPayloadStrips,
        ),
        lastBucketIncreasePercent,
        continuousGrowthMinutes,
        increasingForLastHour,
      },
      thresholds,
    );

    return {
      status: 'ok',
      windowStart: new Date(cutoff).toISOString(),
      windowSeconds: Math.floor(normalizedWindowMs / 1000),
      requestsInWindow,
      totalEvents: currentAggregates.totalEvents,
      totalValidationErrors: currentAggregates.totalValidationErrors,
      totalPayloadStrips: currentAggregates.totalPayloadStrips,
      totalDetails: currentAggregates.totalDetails,
      eventsPerMinuteAvg: Number(
        (
          currentAggregates.totalEvents /
          Math.max(1, Math.ceil(normalizedWindowMs / 60_000))
        ).toFixed(2),
      ),
      failureRatePerThousandRequests,
      strippingRatePerThousandRequests,
      distribution: currentAggregates.distribution,
      byDto: currentAggregates.byDto,
      byRoute: currentAggregates.byRoute,
      byTenant: currentAggregates.byTenant,
      eventsPerMinute: this.buildContractMinuteSeries(relevant, cutoff, normalizedWindowMs),
      thresholds,
      trends: {
        previousWindowStart: new Date(previousCutoff).toISOString(),
        previousWindowSeconds: Math.floor(normalizedWindowMs / 1000),
        previousTotalEvents: previousAggregates.totalEvents,
        previousValidationErrors: previousAggregates.totalValidationErrors,
        previousPayloadStrips: previousAggregates.totalPayloadStrips,
        totalIncreasePercent: this.computePercentageChange(
          currentAggregates.totalEvents,
          previousAggregates.totalEvents,
        ),
        validationIncreasePercent: this.computePercentageChange(
          currentAggregates.totalValidationErrors,
          previousAggregates.totalValidationErrors,
        ),
        payloadIncreasePercent: this.computePercentageChange(
          currentAggregates.totalPayloadStrips,
          previousAggregates.totalPayloadStrips,
        ),
        lastBucketIncreasePercent,
        continuousGrowthMinutes,
        continuousGrowthBuckets,
        increasingForLastHour,
      },
      severity,
    };
  }

  maskIp(ip: unknown): string {
    return maskTelemetryIp(ip);
  }

  private aggregateRoutes(events: RequestTelemetryRecord[]): Map<string, RouteAggregate> {
    const aggregate = new Map<string, RouteAggregate>();

    for (const event of events) {
      const key = `${event.method} ${event.route}`;
      const existing = aggregate.get(key);

      if (!existing) {
        aggregate.set(key, {
          route: event.route,
          method: event.method,
          requestCount: 1,
          totalDurationMs: event.durationMs,
          durationsMs: [event.durationMs],
          errorCount: event.statusCode >= 400 ? 1 : 0,
          status2xx: event.statusCode >= 200 && event.statusCode < 400 ? 1 : 0,
          status4xx: event.statusCode >= 400 && event.statusCode < 500 ? 1 : 0,
          status5xx: event.statusCode >= 500 ? 1 : 0,
          lastErrorAt: event.statusCode >= 400 ? event.at : null,
        });
        continue;
      }

      existing.requestCount += 1;
      existing.totalDurationMs += event.durationMs;
      existing.durationsMs.push(event.durationMs);

      if (event.statusCode >= 400) {
        existing.errorCount += 1;
        existing.lastErrorAt = event.at;
      }

      if (event.statusCode >= 200 && event.statusCode < 400) {
        existing.status2xx += 1;
      } else if (event.statusCode >= 400 && event.statusCode < 500) {
        existing.status4xx += 1;
      } else if (event.statusCode >= 500) {
        existing.status5xx += 1;
      }
    }

    return aggregate;
  }

  private aggregateContractEvents(
    events: ContractAnomalyRecord[],
    requestCountsByRoute: Map<string, number>,
    topLimit: number,
  ): {
    totalEvents: number;
    totalValidationErrors: number;
    totalPayloadStrips: number;
    totalDetails: number;
    distribution: ContractAnomalySummary[];
    byDto: ContractAnomalyDtoSummary[];
    byRoute: ContractAnomalyRouteSummary[];
    byTenant: ContractAnomalyTenantSummary[];
  } {
    const distributionMap = new Map<string, ContractAnomalySummary>();
    const dtoMap = new Map<string, ContractDtoAggregate>();
    const routeMap = new Map<string, ContractRouteAggregate>();
    const tenantMap = new Map<string, ContractTenantAggregate>();
    let totalValidationErrors = 0;
    let totalPayloadStrips = 0;
    let totalDetails = 0;

    for (const event of events) {
      totalDetails += event.detailCount;
      if (event.type === 'validation_failed') {
        totalValidationErrors += 1;
      } else {
        totalPayloadStrips += 1;
      }

      const distributionKey = `${event.type}:${event.dto}`;
      const distributionEntry = distributionMap.get(distributionKey);
      if (!distributionEntry) {
        distributionMap.set(distributionKey, {
          dto: event.dto,
          type: event.type,
          count: 1,
          detailCount: event.detailCount,
          lastOccurrenceMs: event.at,
        });
      } else {
        distributionEntry.count += 1;
        distributionEntry.detailCount += event.detailCount;
        distributionEntry.lastOccurrenceMs = Math.max(distributionEntry.lastOccurrenceMs, event.at);
      }

      const dtoEntry = dtoMap.get(event.dto);
      const routeLabel = this.toContractRouteLabel(event.method, event.route, event.origin);
      if (!dtoEntry) {
        dtoMap.set(event.dto, {
          dto: event.dto,
          count: 1,
          validationFailed: event.type === 'validation_failed' ? 1 : 0,
          payloadStripped: event.type === 'payload_stripped' ? 1 : 0,
          detailCount: event.detailCount,
          lastOccurrenceAt: event.at,
          routes: new Map(routeLabel ? [[routeLabel, 1]] : []),
        });
      } else {
        dtoEntry.count += 1;
        dtoEntry.detailCount += event.detailCount;
        dtoEntry.lastOccurrenceAt = Math.max(dtoEntry.lastOccurrenceAt, event.at);
        if (event.type === 'validation_failed') {
          dtoEntry.validationFailed += 1;
        } else {
          dtoEntry.payloadStripped += 1;
        }
        if (routeLabel) {
          dtoEntry.routes.set(routeLabel, (dtoEntry.routes.get(routeLabel) || 0) + 1);
        }
      }

      const routeKey = `${event.origin}:${event.method || 'UNKNOWN'}:${event.route || '/unknown'}`;
      const routeEntry = routeMap.get(routeKey);
      if (!routeEntry) {
        routeMap.set(routeKey, {
          route: event.route || '/unknown',
          method: event.method,
          module: event.module,
          origin: event.origin,
          operationType: event.operationType,
          count: 1,
          validationFailed: event.type === 'validation_failed' ? 1 : 0,
          payloadStripped: event.type === 'payload_stripped' ? 1 : 0,
          detailCount: event.detailCount,
          lastOccurrenceAt: event.at,
        });
      } else {
        routeEntry.count += 1;
        routeEntry.detailCount += event.detailCount;
        routeEntry.lastOccurrenceAt = Math.max(routeEntry.lastOccurrenceAt, event.at);
        if (event.type === 'validation_failed') {
          routeEntry.validationFailed += 1;
        } else {
          routeEntry.payloadStripped += 1;
        }
      }

      const tenantKey = event.tenantHash || 'global';
      const tenantEntry = tenantMap.get(tenantKey);
      if (!tenantEntry) {
        tenantMap.set(tenantKey, {
          tenantHash: tenantKey,
          count: 1,
          validationFailed: event.type === 'validation_failed' ? 1 : 0,
          payloadStripped: event.type === 'payload_stripped' ? 1 : 0,
          detailCount: event.detailCount,
          lastOccurrenceAt: event.at,
        });
      } else {
        tenantEntry.count += 1;
        tenantEntry.detailCount += event.detailCount;
        tenantEntry.lastOccurrenceAt = Math.max(tenantEntry.lastOccurrenceAt, event.at);
        if (event.type === 'validation_failed') {
          tenantEntry.validationFailed += 1;
        } else {
          tenantEntry.payloadStripped += 1;
        }
      }
    }

    const byDto = Array.from(dtoMap.values())
      .map((entry) => ({
        dto: entry.dto,
        count: entry.count,
        validationFailed: entry.validationFailed,
        payloadStripped: entry.payloadStripped,
        detailCount: entry.detailCount,
        lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
        topRoute: this.resolveTopRoute(entry.routes),
      }))
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.validationFailed - left.validationFailed ||
          right.payloadStripped - left.payloadStripped ||
          right.lastOccurrenceAt.localeCompare(left.lastOccurrenceAt)
        );
      })
      .slice(0, topLimit);

    const byRoute = Array.from(routeMap.values())
      .map((entry) => {
        const requestKey =
          entry.origin === 'http' && entry.method && entry.route
            ? `${entry.method} ${entry.route}`
            : null;
        const requests = requestKey ? requestCountsByRoute.get(requestKey) || 0 : 0;

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
          failureRatePerThousandRequests: this.computeRatePerThousand(entry.validationFailed, requests),
          strippingRatePerThousandRequests: this.computeRatePerThousand(entry.payloadStripped, requests),
          totalRatePerThousandRequests: this.computeRatePerThousand(entry.count, requests),
          lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
        };
      })
      .sort((left, right) => {
        return (
          right.count - left.count ||
          (right.totalRatePerThousandRequests || -1) - (left.totalRatePerThousandRequests || -1) ||
          right.lastOccurrenceAt.localeCompare(left.lastOccurrenceAt)
        );
      })
      .slice(0, topLimit);

    const byTenant = Array.from(tenantMap.values())
      .map((entry) => ({
        tenantHash: entry.tenantHash,
        count: entry.count,
        validationFailed: entry.validationFailed,
        payloadStripped: entry.payloadStripped,
        detailCount: entry.detailCount,
        lastOccurrenceAt: new Date(entry.lastOccurrenceAt).toISOString(),
      }))
      .sort((left, right) => {
        return (
          right.count - left.count ||
          right.validationFailed - left.validationFailed ||
          right.lastOccurrenceAt.localeCompare(left.lastOccurrenceAt)
        );
      })
      .slice(0, topLimit);

    return {
      totalEvents: events.length,
      totalValidationErrors,
      totalPayloadStrips,
      totalDetails,
      distribution: Array.from(distributionMap.values())
        .sort((left, right) => {
          return (
            right.count - left.count ||
            right.detailCount - left.detailCount ||
            right.lastOccurrenceMs - left.lastOccurrenceMs
          );
        })
        .slice(0, topLimit),
      byDto,
      byRoute,
      byTenant,
    };
  }

  private buildContractMinuteSeries(
    events: ContractAnomalyRecord[],
    windowStartMs: number,
    _windowMs: number,
  ): ContractAnomalyMinuteSummary[] {
    const bucketMap = new Map<number, ContractEventMinuteAggregate>();
    const alignedStart = Math.floor(windowStartMs / 60_000) * 60_000;
    const alignedEnd = Math.floor(Date.now() / 60_000) * 60_000;
    const bucketCount = Math.max(1, Math.floor((alignedEnd - alignedStart) / 60_000) + 1);

    for (const event of events) {
      const minuteStart = Math.floor(event.at / 60_000) * 60_000;
      const entry = bucketMap.get(minuteStart);
      if (!entry) {
        bucketMap.set(minuteStart, {
          total: 1,
          validationFailed: event.type === 'validation_failed' ? 1 : 0,
          payloadStripped: event.type === 'payload_stripped' ? 1 : 0,
        });
        continue;
      }

      entry.total += 1;
      if (event.type === 'validation_failed') {
        entry.validationFailed += 1;
      } else {
        entry.payloadStripped += 1;
      }
    }

    return Array.from({ length: bucketCount }, (_, index) => {
      const minuteStart = alignedStart + index * 60_000;
      const entry = bucketMap.get(minuteStart);
      return {
        minuteStart: new Date(minuteStart).toISOString(),
        total: entry?.total || 0,
        validationFailed: entry?.validationFailed || 0,
        payloadStripped: entry?.payloadStripped || 0,
      };
    });
  }

  private buildContractTrendBuckets(bucketMs: number, bucketCount: number, nowMs: number): number[] {
    const safeBucketCount = Math.max(1, Math.floor(bucketCount));
    const startMs = nowMs - safeBucketCount * bucketMs;
    const buckets = Array.from({ length: safeBucketCount }, () => 0);

    for (const event of this.contractEvents) {
      if (event.at < startMs) {
        continue;
      }

      const index = Math.min(
        safeBucketCount - 1,
        Math.max(0, Math.floor((event.at - startMs) / bucketMs)),
      );
      buckets[index] += 1;
    }

    return buckets;
  }

  private resolveContinuousGrowthBuckets(buckets: number[]): number {
    if (buckets.length === 0 || buckets[buckets.length - 1] <= 0) {
      return 0;
    }

    let sequenceLength = 1;
    for (let index = buckets.length - 1; index > 0; index -= 1) {
      if (buckets[index] > buckets[index - 1]) {
        sequenceLength += 1;
        continue;
      }

      break;
    }

    return sequenceLength;
  }

  private resolveContractSeverity(
    current: {
      totalValidationErrors: number;
      totalPayloadStrips: number;
      failureRatePerThousandRequests: number | null;
      strippingRatePerThousandRequests: number | null;
      totalEvents: number;
    },
    trend: {
      totalIncreasePercent: number | null;
      validationIncreasePercent: number | null;
      payloadIncreasePercent: number | null;
      lastBucketIncreasePercent: number | null;
      continuousGrowthMinutes: number;
      increasingForLastHour: boolean;
    },
    thresholds: ContractObservabilityThresholds,
  ): ContractSeveritySnapshot {
    const validationFailed = this.resolveVolumeAndRateSeverity(
      current.totalValidationErrors,
      current.failureRatePerThousandRequests,
      thresholds.validationFailed,
    );
    const payloadStripped = this.resolveVolumeAndRateSeverity(
      current.totalPayloadStrips,
      current.strippingRatePerThousandRequests,
      thresholds.payloadStripped,
    );
    const trendSignalCount = Math.max(
      current.totalEvents,
      current.totalValidationErrors,
      current.totalPayloadStrips,
    );
    const trendSignals = [
      trend.totalIncreasePercent,
      trend.validationIncreasePercent,
      trend.payloadIncreasePercent,
      trend.lastBucketIncreasePercent,
    ].filter((value): value is number => Number.isFinite(value));
    const maxTrendPercent = trendSignals.length > 0 ? Math.max(...trendSignals) : null;
    const trendSeverity =
      trendSignalCount < thresholds.trend.minEventCount
        ? 'normal'
        : maxTrendPercent !== null && maxTrendPercent >= thresholds.trend.criticalPercent
          ? 'critical'
          : trend.continuousGrowthMinutes >= thresholds.trend.criticalGrowthMinutes &&
              trend.increasingForLastHour
            ? 'critical'
            : maxTrendPercent !== null && maxTrendPercent >= thresholds.trend.warningPercent
              ? 'warning'
              : trend.continuousGrowthMinutes >= thresholds.trend.warningGrowthMinutes
                ? 'warning'
                : 'normal';

    return {
      validationFailed,
      payloadStripped,
      trend: trendSeverity,
      overall: this.maxSeverity(validationFailed, payloadStripped, trendSeverity),
    };
  }

  private resolveVolumeAndRateSeverity(
    volume: number,
    ratePerThousand: number | null,
    thresholds: ContractObservabilityThresholds['validationFailed'],
  ): ContractMetricSeverity {
    if (
      volume >= thresholds.volume.critical ||
      (ratePerThousand !== null && ratePerThousand >= thresholds.ratePerThousandRequests.critical)
    ) {
      return 'critical';
    }

    if (
      volume >= thresholds.volume.warning ||
      (ratePerThousand !== null && ratePerThousand >= thresholds.ratePerThousandRequests.warning)
    ) {
      return 'warning';
    }

    return 'normal';
  }

  private maxSeverity(...levels: ContractMetricSeverity[]): ContractMetricSeverity {
    const weights: Record<ContractMetricSeverity, number> = {
      normal: 0,
      warning: 1,
      critical: 2,
    };

    return levels.reduce((current, candidate) => {
      return weights[candidate] > weights[current] ? candidate : current;
    }, 'normal' as ContractMetricSeverity);
  }

  private countRequestsInWindow(cutoff: number, _nowMs: number): number {
    let count = 0;

    for (const event of this.requestEvents) {
      if (event.at >= cutoff) {
        count += 1;
      }
    }

    return count;
  }

  private countRequestsByRoute(cutoff: number, _nowMs: number): Map<string, number> {
    const counts = new Map<string, number>();

    for (const event of this.requestEvents) {
      if (event.at < cutoff) {
        continue;
      }

      const key = `${event.method} ${event.route}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return counts;
  }

  private toRouteSummary(entry: RouteAggregate): RouteTelemetrySummary {
    const durations = [...entry.durationsMs].sort((left, right) => left - right);
    const p95Index =
      durations.length > 0 ? Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1) : -1;

    return {
      route: entry.route,
      method: entry.method,
      requestCount: entry.requestCount,
      avgMs:
        entry.requestCount > 0 ? Number((entry.totalDurationMs / entry.requestCount).toFixed(2)) : null,
      p95Ms: p95Index >= 0 ? Number(durations[p95Index].toFixed(2)) : null,
      errorCount: entry.errorCount,
      errorRate: this.computeRate(entry.errorCount, entry.requestCount),
      status2xx: entry.status2xx,
      status4xx: entry.status4xx,
      status5xx: entry.status5xx,
      lastErrorAt: entry.lastErrorAt ? new Date(entry.lastErrorAt).toISOString() : null,
    };
  }

  private isEligibleForTopSlowRoutes(entry: RouteTelemetrySummary): boolean {
    return entry.requestCount >= MIN_REQUESTS_FOR_ROUTE_TOP_LIST;
  }

  private isEligibleForTopErrorRoutes(entry: RouteTelemetrySummary): boolean {
    if (entry.errorCount <= 0) {
      return false;
    }

    return (
      entry.requestCount >= MIN_REQUESTS_FOR_ROUTE_TOP_LIST ||
      entry.errorCount >= MIN_ERRORS_FOR_ROUTE_ERROR_LIST
    );
  }

  private mapSecurityAggregate(source: Map<string, SecurityAggregate>, limit: number): SecurityTelemetryIpSummary[] {
    return Array.from(source.entries())
      .map(([ip, data]) => ({
        ip,
        count: data.count,
        lastSeenAt: new Date(data.lastSeenAt).toISOString(),
        route: data.route,
      }))
      .sort((left, right) => right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt))
      .slice(0, Math.max(1, limit));
  }

  private bumpSecurityAggregate(
    source: Map<string, SecurityAggregate>,
    ip: string,
    route: string,
    at: number,
  ) {
    const existing = source.get(ip);
    if (!existing) {
      source.set(ip, {
        count: 1,
        lastSeenAt: at,
        route,
      });
      return;
    }

    existing.count += 1;
    existing.lastSeenAt = at;
    existing.route = route;
  }

  private pruneRequestEvents(cutoff = Date.now() - REQUEST_RETENTION_MS) {
    while (this.requestEvents.length > 0 && this.requestEvents[0].at < cutoff) {
      this.requestEvents.shift();
    }
  }

  private trimRequestEvents(limit = REQUEST_MAX_ENTRIES) {
    while (this.requestEvents.length > limit) {
      this.requestEvents.shift();
    }
  }

  private pruneSecurityEvents(cutoff = Date.now() - SECURITY_RETENTION_MS) {
    while (this.securityEvents.length > 0 && this.securityEvents[0].at < cutoff) {
      this.securityEvents.shift();
    }
  }

  private trimSecurityEvents(limit = SECURITY_MAX_ENTRIES) {
    while (this.securityEvents.length > limit) {
      this.securityEvents.shift();
    }
  }

  private pruneContractEvents(cutoff = Date.now() - CONTRACT_RETENTION_MS) {
    while (this.contractEvents.length > 0 && this.contractEvents[0].at < cutoff) {
      this.contractEvents.shift();
    }
  }

  private trimContractEvents(limit = CONTRACT_MAX_ENTRIES) {
    while (this.contractEvents.length > limit) {
      this.contractEvents.shift();
    }
  }

  private normalizeStatusCode(statusCode: unknown): number {
    const numeric = Number(statusCode);
    if (!Number.isFinite(numeric)) {
      return 500;
    }

    return Math.max(100, Math.min(599, Math.floor(numeric)));
  }

  private normalizeWindowMs(windowMs: number, fallback: number): number {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      return fallback;
    }

    return Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Math.floor(windowMs)));
  }

  private computeRate(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(2));
  }

  private computeRatePerThousand(numerator: number, denominator: number): number | null {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return null;
    }

    return Number(((numerator / denominator) * 1000).toFixed(2));
  }

  private computePercentageChange(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return null;
    }

    if (previous <= 0) {
      return current > 0 ? null : 0;
    }

    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private normalizeContractOrigin(origin: unknown): ContractEventOrigin {
    return origin === 'http' || origin === 'ws' || origin === 'system' ? origin : 'system';
  }

  private normalizeContractRoute(
    route: unknown,
    origin: ContractEventOrigin,
  ): string | null {
    if (typeof route === 'string' && route.trim().length > 0) {
      return normalizeTelemetryPath(route);
    }

    return origin === 'ws' ? '/ws/unknown' : null;
  }

  private normalizeContractMethod(
    method: unknown,
    origin: ContractEventOrigin,
  ): string | null {
    if (typeof method === 'string' && method.trim().length > 0) {
      return normalizeTelemetryMethod(method);
    }

    return origin === 'ws' ? 'WS' : null;
  }

  private normalizeContractModule(moduleName: unknown, route: string | null): string | null {
    if (typeof moduleName === 'string' && moduleName.trim().length > 0) {
      return moduleName.trim().toLowerCase();
    }

    return resolveTelemetryModule(route);
  }

  private normalizeContractOperationType(
    operationType: unknown,
    method: string | null,
    origin: ContractEventOrigin,
  ): ContractOperationType {
    if (
      operationType === 'read' ||
      operationType === 'create' ||
      operationType === 'update' ||
      operationType === 'delete' ||
      operationType === 'emit' ||
      operationType === 'command' ||
      operationType === 'unknown'
    ) {
      return operationType;
    }

    return resolveContractOperationType(method, origin);
  }

  private normalizeDetailCount(detailCount: unknown): number {
    const numeric = Number(detailCount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 1;
    }

    return Math.max(1, Math.floor(numeric));
  }

  private toEventTimestamp(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.floor(value);
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private toMonotonicTimestamp(timestamp: number, previousTimestamp?: number): number {
    const safeTimestamp = Number.isFinite(timestamp) ? Math.floor(timestamp) : Date.now();
    if (!Number.isFinite(previousTimestamp)) {
      return safeTimestamp;
    }

    return Math.max(safeTimestamp, Number(previousTimestamp) + 1);
  }

  private resolveTopRoute(routes: Map<string, number>): string | null {
    let topRoute: string | null = null;
    let topCount = 0;

    for (const [route, count] of routes.entries()) {
      if (count > topCount) {
        topRoute = route;
        topCount = count;
      }
    }

    return topRoute;
  }

  private toContractRouteLabel(
    method: string | null,
    route: string | null,
    origin: ContractEventOrigin,
  ): string | null {
    if (route && method) {
      return `${method} ${route}`;
    }

    if (route) {
      return route;
    }

    return origin === 'ws' ? 'WS /ws/unknown' : null;
  }
}
