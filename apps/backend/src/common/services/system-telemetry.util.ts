export type TelemetryRequestLike = {
  route?: {
    path?: string | string[];
  };
  baseUrl?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  path?: unknown;
  headers?: Record<string, unknown>;
  ip?: unknown;
  socket?: {
    remoteAddress?: unknown;
  };
  connection?: {
    remoteAddress?: unknown;
  };
};

const REQUEST_EXCLUDED_PATHS = [
  '/api/health',
  '/api/system/dashboard',
  '/api/system/dashboard/module-cards',
  '/api/system/dashboard/layout',
  '/api/system/maintenance/state',
  '/api/system/notifications',
  '/api/system/notifications/unread-count',
  '/api/system/notifications/stream',
  '/api/system/update/status',
  '/api/system/update/log',
  '/api/system/version',
  '/api/system/metrics',
];

const SECURITY_EXCLUDED_PATHS = [
  '/api/health',
  '/api/system/notifications',
  '/api/system/notifications/unread-count',
  '/api/system/notifications/stream',
  '/api/system/metrics',
];

const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_SEGMENT_PATTERN = /^[0-9a-f]{24}$/i;
const NUMERIC_SEGMENT_PATTERN = /^\d+$/;
const LONG_HEX_SEGMENT_PATTERN = /^[0-9a-f]{16,}$/i;
const OPAQUE_SEGMENT_PATTERN = /^[a-z0-9_\-~=+.]{24,}$/i;

export function normalizeTelemetryMethod(method: unknown): string {
  const normalized = String(method || '').trim().toUpperCase();
  return normalized.length > 0 ? normalized : 'GET';
}

export function normalizeTelemetryPath(rawPath: unknown): string {
  const base = String(rawPath || '/').trim();
  const [pathWithoutQuery] = base.split('?');
  const [pathWithoutHash] = pathWithoutQuery.split('#');
  const segments = pathWithoutHash
    .split('/')
    .map((segment) => normalizePathSegment(segment))
    .filter((segment, index) => segment.length > 0 || index === 0);
  const normalized = segments.join('/').replace(/\/+/g, '/').toLowerCase();

  if (!normalized || normalized === '') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function resolveTelemetryRoute(request: TelemetryRequestLike): string {
  const routePath = request?.route?.path;
  const baseUrl = request?.baseUrl;

  if (typeof routePath === 'string' && routePath.trim().length > 0) {
    return normalizeTelemetryPath(`${String(baseUrl || '')}${routePath}`);
  }

  if (Array.isArray(routePath) && routePath.length > 0) {
    return normalizeTelemetryPath(`${String(baseUrl || '')}${String(routePath[0] || '')}`);
  }

  return normalizeTelemetryPath(request?.originalUrl || request?.url || request?.path || '/');
}

export function shouldCollectRequestTelemetry(method: string, route: string): boolean {
  if (normalizeTelemetryMethod(method) === 'OPTIONS') {
    return false;
  }

  if (!matchesPath(route, '/api')) {
    return false;
  }

  return !REQUEST_EXCLUDED_PATHS.some((path) => matchesPath(route, path));
}

export function shouldCollectSecurityTelemetry(method: string, route: string): boolean {
  if (normalizeTelemetryMethod(method) === 'OPTIONS') {
    return false;
  }

  if (!matchesPath(route, '/api')) {
    return false;
  }

  return !SECURITY_EXCLUDED_PATHS.some((path) => matchesPath(route, path));
}

export function resolveTelemetryClientIp(request: TelemetryRequestLike): string {
  const forwarded = readHeader(request, 'x-forwarded-for');
  if (forwarded) {
    const firstForwarded = forwarded
      .split(',')
      .map((item) => item.trim())
      .find((item) => item.length > 0);
    if (firstForwarded) {
      return normalizeIp(firstForwarded);
    }
  }

  const realIp = readHeader(request, 'x-real-ip');
  if (realIp) {
    return normalizeIp(realIp);
  }

  const directIp = request?.ip || request?.socket?.remoteAddress || request?.connection?.remoteAddress;
  return normalizeIp(directIp);
}

export function maskTelemetryIp(ip: unknown): string {
  const normalized = normalizeIp(ip);
  if (normalized === 'unknown') {
    return normalized;
  }

  if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.${parts[3]}`;
    }
  }

  if (normalized.includes(':')) {
    const parts = normalized.split(':').filter((part) => part.length > 0);
    if (parts.length >= 2) {
      return `${parts.slice(0, 2).join(':')}:*`;
    }
  }

  return normalized;
}

function normalizePathSegment(segment: string): string {
  const trimmed = String(segment || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed === '*') {
    return ':wildcard';
  }

  if (trimmed.startsWith(':')) {
    return normalizeRouteParameter(trimmed);
  }

  if (
    NUMERIC_SEGMENT_PATTERN.test(trimmed) ||
    UUID_SEGMENT_PATTERN.test(trimmed) ||
    OBJECT_ID_SEGMENT_PATTERN.test(trimmed)
  ) {
    return ':id';
  }

  if (LONG_HEX_SEGMENT_PATTERN.test(trimmed) || OPAQUE_SEGMENT_PATTERN.test(trimmed)) {
    return ':token';
  }

  return trimmed;
}

function normalizeRouteParameter(segment: string): string {
  const parameter = segment.split('(')[0].trim();
  if (!parameter.startsWith(':')) {
    return ':id';
  }

  const name = parameter.slice(1).replace(/[^a-z0-9_]/gi, '').toLowerCase();
  return `:${name || 'id'}`;
}

function matchesPath(actualPath: string, expectedBasePath: string): boolean {
  return actualPath === expectedBasePath || actualPath.startsWith(`${expectedBasePath}/`);
}

function readHeader(request: TelemetryRequestLike, headerName: string): string | null {
  const headers = request?.headers || {};
  const value = headers[headerName] || headers[headerName.toLowerCase()];
  const headerValue = Array.isArray(value) ? value[0] : value;
  if (typeof headerValue !== 'string') {
    return null;
  }

  const normalized = headerValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIp(value: unknown): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'unknown';
  }

  if (normalized.startsWith('::ffff:')) {
    return normalized.slice(7);
  }

  return normalized;
}


