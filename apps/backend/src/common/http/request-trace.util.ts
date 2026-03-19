import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';
export const TRACEPARENT_HEADER = 'traceparent';

export type RequestTraceContext = {
  requestId: string;
  traceId: string;
  spanId: string;
  traceparent: string;
  startedAt: number;
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

export function buildOutgoingTraceHeaders(carrier: HeaderCarrier | null | undefined) {
  const trace = carrier ? ensureRequestTrace(carrier) : null;
  if (!trace) {
    return {};
  }

  return {
    [REQUEST_ID_HEADER]: trace.requestId,
    [TRACE_ID_HEADER]: trace.traceId,
    [TRACEPARENT_HEADER]: trace.traceparent,
  };
}
