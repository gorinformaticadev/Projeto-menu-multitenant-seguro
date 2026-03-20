import { Injectable } from '@nestjs/common';
import {
  maskTelemetryIp,
  normalizeTelemetryMethod,
  normalizeTelemetryPath,
  resolveTelemetryClientIp,
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

export type OperationalTelemetryEventType =
  | 'version_fallback'
  | 'request_retry'
  | 'request_queued'
  | 'request_queue_rejected'
  | 'request_queue_timeout'
  | 'request_timeout'
  | 'payload_rejected'
  | 'response_overflow'
  | 'circuit_open'
  | 'circuit_half_open'
  | 'circuit_recovered'
  | 'runtime_pressure'
  | 'stale_snapshot_served'
  | 'slow_success'
  | 'auto_mitigation';

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

export interface OperationalTelemetrySnapshot {
  status: 'ok';
  windowStart: string;
  windowSeconds: number;
  totalEventsRecent: number;
  byType: Array<{
    type: OperationalTelemetryEventType;
    count: number;
  }>;
  topRoutes: Array<{
    route: string;
    count: number;
  }>;
  recent: Array<{
    type: OperationalTelemetryEventType;
    statusCode: number | null;
    method: string;
    route: string;
    requestId: string | null;
    traceId: string | null;
    tenantId: string | null;
    userId: string | null;
    apiVersion: string | null;
    mitigationFlags: string[];
    detail: string | null;
    at: string;
  }>;
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

type OperationalTelemetryRecord = {
  at: number;
  type: OperationalTelemetryEventType;
  method: string;
  route: string;
  statusCode: number | null;
  requestId: string | null;
  traceId: string | null;
  tenantId: string | null;
  userId: string | null;
  apiVersion: string | null;
  mitigationFlags: string[];
  detail: string | null;
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

const REQUEST_RETENTION_MS = 15 * 60 * 1000;
const REQUEST_MAX_ENTRIES = 5_000;
const SECURITY_RETENTION_MS = 6 * 60 * 60 * 1000;
const SECURITY_MAX_ENTRIES = 2_000;
const OPERATIONAL_RETENTION_MS = 60 * 60 * 1000;
const OPERATIONAL_MAX_ENTRIES = 3_000;
const DEFAULT_TOP_LIMIT = 5;
const RECENT_SECURITY_LIMIT = 20;
const RECENT_OPERATIONAL_LIMIT = 20;
const MIN_REQUESTS_FOR_ROUTE_TOP_LIST = 3;
const MIN_ERRORS_FOR_ROUTE_ERROR_LIST = 2;

@Injectable()
export class SystemTelemetryService {
  private readonly requestEvents: RequestTelemetryRecord[] = [];
  private readonly securityEvents: SecurityTelemetryRecord[] = [];
  private readonly operationalEvents: OperationalTelemetryRecord[] = [];

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

  recordOperationalEvent(input: {
    type: OperationalTelemetryEventType;
    method?: unknown;
    route?: unknown;
    request?: Record<string, any>;
    statusCode?: number | null;
    requestId?: unknown;
    traceId?: unknown;
    tenantId?: unknown;
    userId?: unknown;
    apiVersion?: unknown;
    mitigationFlags?: unknown;
    detail?: unknown;
  }): void {
    const method = normalizeTelemetryMethod(input.method || input.request?.method);
    const route = normalizeTelemetryPath(
      input.route || (input.request ? resolveTelemetryRoute(input.request) : '/'),
    );

    this.pruneOperationalEvents();
    const lastAt =
      this.operationalEvents.length > 0
        ? this.operationalEvents[this.operationalEvents.length - 1].at
        : undefined;

    this.operationalEvents.push({
      at: this.toMonotonicTimestamp(Date.now(), lastAt),
      type: input.type,
      method,
      route,
      statusCode:
        input.statusCode === null || input.statusCode === undefined
          ? null
          : this.normalizeStatusCode(input.statusCode),
      requestId: this.normalizeOperationalText(input.requestId),
      traceId: this.normalizeOperationalText(input.traceId),
      tenantId: this.normalizeOperationalText(input.tenantId),
      userId: this.normalizeOperationalText(input.userId),
      apiVersion: this.normalizeOperationalText(input.apiVersion),
      mitigationFlags: this.normalizeOperationalFlags(input.mitigationFlags),
      detail: this.normalizeOperationalDetail(input.detail),
    });

    this.trimOperationalEvents();
  }

  getApiSnapshot(windowMs = REQUEST_RETENTION_MS, topLimit = DEFAULT_TOP_LIMIT): ApiTelemetrySnapshot {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, REQUEST_RETENTION_MS);
    const cutoff = Date.now() - normalizedWindowMs;
    this.pruneRequestEvents(cutoff);

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
      status: 'ok' as const,
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
    this.pruneSecurityEvents(cutoff);

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
      status: 'ok' as const,
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

  getOperationalSnapshot(
    windowMs = OPERATIONAL_RETENTION_MS,
    topLimit = DEFAULT_TOP_LIMIT,
  ): OperationalTelemetrySnapshot {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs, OPERATIONAL_RETENTION_MS);
    const cutoff = Date.now() - normalizedWindowMs;
    this.pruneOperationalEvents(cutoff);

    const relevant = this.operationalEvents.filter((event) => event.at >= cutoff);
    const byType = new Map<OperationalTelemetryEventType, number>();
    const byRoute = new Map<string, number>();

    for (const event of relevant) {
      byType.set(event.type, (byType.get(event.type) || 0) + 1);
      byRoute.set(event.route, (byRoute.get(event.route) || 0) + 1);
    }

    return {
      status: 'ok',
      windowStart: new Date(cutoff).toISOString(),
      windowSeconds: Math.floor(normalizedWindowMs / 1000),
      totalEventsRecent: relevant.length,
      byType: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
      topRoutes: Array.from(byRoute.entries())
        .map(([route, count]) => ({ route, count }))
        .sort((left, right) => right.count - left.count || left.route.localeCompare(right.route))
        .slice(0, Math.max(1, topLimit)),
      recent: relevant
        .slice(-RECENT_OPERATIONAL_LIMIT)
        .reverse()
        .map((event) => ({
          type: event.type,
          statusCode: event.statusCode,
          method: event.method,
          route: event.route,
          requestId: event.requestId,
          traceId: event.traceId,
          tenantId: event.tenantId,
          userId: event.userId,
          apiVersion: event.apiVersion,
          mitigationFlags: event.mitigationFlags,
          detail: event.detail,
          at: new Date(event.at).toISOString(),
        })),
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

  private pruneOperationalEvents(cutoff = Date.now() - OPERATIONAL_RETENTION_MS) {
    while (this.operationalEvents.length > 0 && this.operationalEvents[0].at < cutoff) {
      this.operationalEvents.shift();
    }
  }

  private trimOperationalEvents(limit = OPERATIONAL_MAX_ENTRIES) {
    while (this.operationalEvents.length > limit) {
      this.operationalEvents.shift();
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

  private toMonotonicTimestamp(timestamp: number, previousTimestamp?: number): number {
    const safeTimestamp = Number.isFinite(timestamp) ? Math.floor(timestamp) : Date.now();
    if (!Number.isFinite(previousTimestamp)) {
      return safeTimestamp;
    }

    return Math.max(safeTimestamp, Number(previousTimestamp) + 1);
  }

  private normalizeOperationalText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized.slice(0, 128) : null;
  }

  private normalizeOperationalDetail(value: unknown): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
  }

  private normalizeOperationalFlags(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => this.normalizeOperationalText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 8);
  }
}
