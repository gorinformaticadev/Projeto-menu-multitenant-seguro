import {
  DASHBOARD_MAX_NOTIFICATION_ALERTS,
  DASHBOARD_MAX_WIDGET_IDS,
} from '@contracts/dashboard';
import type { ApiVersion } from '@contracts/http';

const TOP_LEVEL_KEYS = [
  'generatedAt',
  'responseTimeMs',
  'filtersApplied',
  'version',
  'uptime',
  'maintenance',
  'system',
  'cpu',
  'memory',
  'disk',
  'database',
  'redis',
  'workers',
  'api',
  'routeLatency',
  'routeErrors',
  'security',
  'backup',
  'jobs',
  'errors',
  'tenants',
  'notifications',
  'runtimeMitigation',
  'widgets',
] as const;

const METRIC_KEYS = [
  'version',
  'uptime',
  'maintenance',
  'system',
  'cpu',
  'memory',
  'disk',
  'database',
  'redis',
  'workers',
  'api',
  'routeLatency',
  'routeErrors',
  'security',
  'backup',
  'jobs',
  'errors',
  'tenants',
  'notifications',
] as const;

export function assertRuntimeSystemDashboardContract(
  value: unknown,
  apiVersion: ApiVersion,
): void {
  const payload = toRecord(value, 'dashboard');
  assertExactKeys(payload, TOP_LEVEL_KEYS, 'dashboard');

  if (!isIsoDateString(payload.generatedAt)) {
    throw new Error('dashboard.generatedAt must be an ISO datetime string');
  }

  if (!isNonNegativeNumber(payload.responseTimeMs)) {
    throw new Error('dashboard.responseTimeMs must be a non-negative number');
  }

  const filtersApplied = toRecord(payload.filtersApplied, 'dashboard.filtersApplied');
  if (!Number.isInteger(filtersApplied.periodMinutes) || Number(filtersApplied.periodMinutes) < 5) {
    throw new Error('dashboard.filtersApplied.periodMinutes must be a valid integer');
  }

  if (
    filtersApplied.tenantId !== null &&
    typeof filtersApplied.tenantId !== 'string'
  ) {
    throw new Error('dashboard.filtersApplied.tenantId must be null or string');
  }

  if (
    filtersApplied.severity !== 'all' &&
    filtersApplied.severity !== 'info' &&
    filtersApplied.severity !== 'warning' &&
    filtersApplied.severity !== 'critical'
  ) {
    throw new Error('dashboard.filtersApplied.severity is invalid');
  }

  for (const metricKey of METRIC_KEYS) {
    const metric = toRecord(payload[metricKey], `dashboard.${metricKey}`);
    const status = metric.status;
    if (typeof status !== 'string' || status.trim().length === 0) {
      throw new Error(`dashboard.${metricKey}.status must be a non-empty string`);
    }
  }

  const widgets = toRecord(payload.widgets, 'dashboard.widgets');
  if (!Array.isArray(widgets.available) || widgets.available.length > DASHBOARD_MAX_WIDGET_IDS) {
    throw new Error('dashboard.widgets.available is invalid');
  }
  if (!widgets.available.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    throw new Error('dashboard.widgets.available contains invalid ids');
  }

  const notifications = toRecord(payload.notifications, 'dashboard.notifications');
  if (notifications.status === 'ok') {
    if (
      !Array.isArray(notifications.recentOperationalAlerts) ||
      notifications.recentOperationalAlerts.length > DASHBOARD_MAX_NOTIFICATION_ALERTS
    ) {
      throw new Error('dashboard.notifications.recentOperationalAlerts is invalid');
    }

    for (const [index, item] of notifications.recentOperationalAlerts.entries()) {
      const alert = toRecord(item, `dashboard.notifications.recentOperationalAlerts[${index}]`);
      if (
        typeof alert.id !== 'string' ||
        typeof alert.title !== 'string' ||
        typeof alert.body !== 'string' ||
        typeof alert.severity !== 'string' ||
        !isIsoDateString(alert.createdAt)
      ) {
        throw new Error(
          `dashboard.notifications.recentOperationalAlerts[${index}] has invalid required fields`,
        );
      }

      if (apiVersion === '2') {
        if (
          alert.action !== null &&
          alert.action !== undefined &&
          typeof alert.action !== 'string'
        ) {
          throw new Error(
            `dashboard.notifications.recentOperationalAlerts[${index}].action is invalid for v2`,
          );
        }
      } else if (Object.prototype.hasOwnProperty.call(alert, 'action')) {
        throw new Error(
          `dashboard.notifications.recentOperationalAlerts[${index}].action must not exist in v1`,
        );
      }
    }
  }

  const runtimeMitigation = toRecord(payload.runtimeMitigation, 'dashboard.runtimeMitigation');
  if (!isNonNegativeNumber(runtimeMitigation.adaptiveThrottleFactor)) {
    throw new Error('dashboard.runtimeMitigation.adaptiveThrottleFactor is invalid');
  }
  if (
    runtimeMitigation.pressureCause !== 'normal' &&
    runtimeMitigation.pressureCause !== 'cpu' &&
    runtimeMitigation.pressureCause !== 'gc' &&
    runtimeMitigation.pressureCause !== 'io' &&
    runtimeMitigation.pressureCause !== 'mixed' &&
    runtimeMitigation.pressureCause !== 'cluster'
  ) {
    throw new Error('dashboard.runtimeMitigation.pressureCause is invalid');
  }
  if (
    !isNonNegativeNumber(runtimeMitigation.instanceCount) ||
    !isNonNegativeNumber(runtimeMitigation.overloadedInstances) ||
    !isNonNegativeNumber(runtimeMitigation.clusterQueueDepth)
  ) {
    throw new Error('dashboard.runtimeMitigation counters are invalid');
  }
  if (
    runtimeMitigation.clusterRecentApiLatencyMs !== null &&
    !isNonNegativeNumber(runtimeMitigation.clusterRecentApiLatencyMs)
  ) {
    throw new Error('dashboard.runtimeMitigation.clusterRecentApiLatencyMs is invalid');
  }
  if (
    typeof runtimeMitigation.degradeHeavyFeatures !== 'boolean' ||
    typeof runtimeMitigation.disableRemoteUpdateChecks !== 'boolean' ||
    typeof runtimeMitigation.rejectHeavyMutations !== 'boolean'
  ) {
    throw new Error('dashboard.runtimeMitigation flags are invalid');
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  path: string,
) {
  const actualKeys = Object.keys(value).sort();
  const normalizedExpected = [...expectedKeys].sort();

  if (actualKeys.length !== normalizedExpected.length) {
    throw new Error(`${path} has an unexpected top-level shape`);
  }

  for (let index = 0; index < normalizedExpected.length; index += 1) {
    if (actualKeys[index] !== normalizedExpected[index]) {
      throw new Error(`${path} has an unexpected top-level shape`);
    }
  }
}

function toRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}

function isIsoDateString(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
