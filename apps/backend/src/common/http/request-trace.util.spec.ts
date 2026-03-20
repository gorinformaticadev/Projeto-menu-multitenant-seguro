import {
  annotateRequestTrace,
  buildOutgoingTraceHeaders,
  ensureRequestTrace,
  getTraceBaggageBytes,
  MAX_TRACE_BAGGAGE_BYTES,
  MAX_TRACE_BAGGAGE_PARSE_BYTES,
  BAGGAGE_HEADER,
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  TRACEPARENT_HEADER,
} from './request-trace.util';

describe('request-trace util', () => {
  it('creates a propagatable trace context and outgoing headers', () => {
    const carrier = {
      headers: {},
    };

    const trace = ensureRequestTrace(carrier as any);
    const headers = buildOutgoingTraceHeaders(carrier as any);

    expect(trace.requestId).toBeTruthy();
    expect(trace.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(trace.spanId).toMatch(/^[a-f0-9]{16}$/);
    expect(trace.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(headers).toEqual({
      [REQUEST_ID_HEADER]: trace.requestId,
      [TRACE_ID_HEADER]: trace.traceId,
      [TRACEPARENT_HEADER]: trace.traceparent,
    });
  });

  it('caps outgoing baggage and keeps only the minimum operational context when the header would grow too much', () => {
    const carrier = {
      headers: {},
    };

    const trace = ensureRequestTrace(carrier as any);
    annotateRequestTrace(carrier as any, {
      tenantId: 'tenant-operacional-muito-longo-1234567890',
      userId: 'user-operacional-muito-longo-1234567890',
      apiVersion: '2',
      mitigationFlags: [
        'feature_degraded',
        'tenant_shed',
        'heavy_mutations_rejected',
        'update_checks_disabled',
      ],
    });

    const headers = buildOutgoingTraceHeaders(carrier as any);
    const baggage = headers[BAGGAGE_HEADER];

    expect(typeof baggage).toBe('string');
    expect(getTraceBaggageBytes(trace)).toBeLessThanOrEqual(MAX_TRACE_BAGGAGE_BYTES);
    expect(baggage).toContain('v=2');
    expect(baggage).not.toContain('feature_degraded');
  });

  it('ignores oversized incoming baggage safely', () => {
    const oversizedBaggage = `mf=${'x'.repeat(MAX_TRACE_BAGGAGE_PARSE_BYTES + 32)}`;
    const carrier = {
      headers: {
        [BAGGAGE_HEADER]: oversizedBaggage,
      },
    };

    const trace = ensureRequestTrace(carrier as any);

    expect(trace.tenantId).toBeNull();
    expect(trace.userId).toBeNull();
    expect(trace.apiVersion).toBeNull();
    expect(trace.mitigationFlags).toEqual([]);
  });
});
