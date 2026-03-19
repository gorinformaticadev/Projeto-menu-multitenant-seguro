import {
  buildOutgoingTraceHeaders,
  ensureRequestTrace,
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
});
