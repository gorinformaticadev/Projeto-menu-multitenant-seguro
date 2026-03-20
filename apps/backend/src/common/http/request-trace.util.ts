import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';
export const TRACEPARENT_HEADER = 'traceparent';
export const BAGGAGE_HEADER = 'baggage';

export type RequestTraceMitigationFlag =
  | 'redis_fallback'
  | 'feature_degraded'
  | 'update_checks_disabled'
  | 'heavy_mutations_rejected'
  | 'tenant_shed';

export type RequestTraceContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  traceparent: string;
  startedAt: number;
  tenantId: string | null;
  userId: string | null;
  apiVersion: string | null;
  mitigationFlags: RequestTraceMitigationFlag[];
};

type HeaderCarrier = {
  headers?: Record<string, string | string[] | undefined>;
  requestTrace?: RequestTraceContext;
};

function readHeader(carrier: HeaderCarrier, headerName: string): string | null {
  const raw = carrier?.headers?.[headerName];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBaggage(rawBaggage: string | null): Record<string, string> {
  if (!rawBaggage) {
    return {};
  }

  return rawBaggage
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.includes('='))
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [keyPart, valuePart] = entry.split('=');
      const key = sanitizeOpaqueId(keyPart || '', 64)?.toLowerCase();
      const value = sanitizeOpaqueId(valuePart || '', 128);
      if (key && value) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

function buildBaggageValue(trace: RequestTraceContext): string | null {
  const entries = [
    trace.tenantId ? `tenant_id=${trace.tenantId}` : null,
    trace.userId ? `user_id=${trace.userId}` : null,
    trace.apiVersion ? `api_version=${trace.apiVersion}` : null,
    trace.mitigationFlags.length > 0
      ? `mitigation_flags=${trace.mitigationFlags.join('.')}`
      : null,
  ].filter(Boolean) as string[];

  return entries.length > 0 ? entries.join(',') : null;
}

function sanitizeOpaqueId(value: string | null, maxLength = 128): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '');
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function resolveTraceIdFromTraceparent(traceparent: string | null): string | null {
  if (!traceparent) {
    return null;
  }

  const match = traceparent.match(/^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i);
  return match ? match[1].toLowerCase() : null;
}

function resolveSpanIdFromTraceparent(traceparent: string | null): string | null {
  if (!traceparent) {
    return null;
  }

  const match = traceparent.match(/^[\da-f]{2}-[\da-f]{32}-([\da-f]{16})-[\da-f]{2}$/i);
  return match ? match[1].toLowerCase() : null;
}

function buildRandomHex(size: number) {
  return randomUUID().replace(/-/g, '').slice(0, size).padEnd(size, '0');
}

export function buildTraceparent(traceId: string, spanId?: string) {
  const normalizedTraceId = sanitizeOpaqueId(traceId, 32)?.toLowerCase() || buildRandomHex(32);
  const normalizedSpanId = sanitizeOpaqueId(spanId || null, 16)?.toLowerCase() || buildRandomHex(16);
  return `00-${normalizedTraceId.padStart(32, '0').slice(-32)}-${normalizedSpanId
    .padStart(16, '0')
    .slice(-16)}-01`;
}

export function ensureRequestTrace(carrier: HeaderCarrier): RequestTraceContext {
  if (carrier.requestTrace) {
    return carrier.requestTrace;
  }

  const baggage = parseBaggage(readHeader(carrier, BAGGAGE_HEADER));
  const requestId =
    sanitizeOpaqueId(readHeader(carrier, REQUEST_ID_HEADER), 96) || randomUUID();
  const traceId =
    sanitizeOpaqueId(readHeader(carrier, TRACE_ID_HEADER), 64) ||
    resolveTraceIdFromTraceparent(readHeader(carrier, TRACEPARENT_HEADER)) ||
    randomUUID().replace(/-/g, '');
  const spanId =
    resolveSpanIdFromTraceparent(readHeader(carrier, TRACEPARENT_HEADER)) || buildRandomHex(16);
  const traceparent = buildTraceparent(traceId, spanId);

  const trace = {
    requestId,
    traceId,
    spanId,
    traceparent,
    startedAt: Date.now(),
    tenantId: sanitizeOpaqueId(baggage.tenant_id || null, 96),
    userId: sanitizeOpaqueId(baggage.user_id || null, 96),
    apiVersion: sanitizeOpaqueId(baggage.api_version || null, 16),
    mitigationFlags: String(baggage.mitigation_flags || '')
      .split('.')
      .map((value) => sanitizeOpaqueId(value, 64))
      .filter((value): value is RequestTraceMitigationFlag => Boolean(value)),
  };

  carrier.requestTrace = trace;
  return trace;
}

export function getRequestTrace(carrier: HeaderCarrier | null | undefined): RequestTraceContext | null {
  if (!carrier) {
    return null;
  }

  return carrier.requestTrace || null;
}

export function annotateRequestTrace(
  carrier: HeaderCarrier | null | undefined,
  input: Partial<Pick<RequestTraceContext, 'tenantId' | 'userId' | 'apiVersion'>> & {
    mitigationFlags?: RequestTraceMitigationFlag[];
  },
): RequestTraceContext | null {
  if (!carrier) {
    return null;
  }

  const trace = ensureRequestTrace(carrier);
  if (input.tenantId !== undefined) {
    trace.tenantId = sanitizeOpaqueId(input.tenantId, 96);
  }
  if (input.userId !== undefined) {
    trace.userId = sanitizeOpaqueId(input.userId, 96);
  }
  if (input.apiVersion !== undefined) {
    trace.apiVersion = sanitizeOpaqueId(input.apiVersion, 16);
  }
  if (Array.isArray(input.mitigationFlags) && input.mitigationFlags.length > 0) {
    const combined = new Set<RequestTraceMitigationFlag>([
      ...trace.mitigationFlags,
      ...input.mitigationFlags,
    ]);
    trace.mitigationFlags = [...combined];
  }

  return trace;
}

export function buildOutgoingTraceHeaders(carrier: HeaderCarrier | null | undefined) {
  const trace = carrier ? ensureRequestTrace(carrier) : null;
  if (!trace) {
    return {};
  }

  const headers: Record<string, string> = {
    [REQUEST_ID_HEADER]: trace.requestId,
    [TRACE_ID_HEADER]: trace.traceId,
    [TRACEPARENT_HEADER]: trace.traceparent,
  };

  const baggage = buildBaggageValue(trace);
  if (baggage) {
    headers[BAGGAGE_HEADER] = baggage;
  }

  return headers;
}
