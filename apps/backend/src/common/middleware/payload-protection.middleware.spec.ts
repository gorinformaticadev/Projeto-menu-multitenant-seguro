import {
  createRequestBodyTimeoutMiddleware,
  PAYLOAD_PROTECTION_LIMITS,
  inspectPayloadValue,
} from './payload-protection.middleware';

describe('payload protection middleware', () => {
  it('accepts a normal shallow payload', () => {
    expect(
      inspectPayloadValue({
        email: 'admin@example.com',
        nested: {
          role: 'ADMIN',
          flags: ['a', 'b'],
        },
      }),
    ).toBeNull();
  });

  it('rejects payloads deeper than the configured limit without recursion overflow', () => {
    let payload: Record<string, unknown> = { leaf: true };

    for (let depth = 0; depth <= PAYLOAD_PROTECTION_LIMITS.maxDepth; depth += 1) {
      payload = { nested: payload };
    }

    expect(inspectPayloadValue(payload)).toEqual(
      expect.objectContaining({
        statusCode: 413,
        code: 'PAYLOAD_TOO_DEEP',
      }),
    );
  });

  it('rejects oversized arrays', () => {
    expect(
      inspectPayloadValue({
        items: Array.from({ length: PAYLOAD_PROTECTION_LIMITS.maxArrayLength + 1 }, (_, index) => ({
          id: index,
        })),
      }),
    ).toEqual(
      expect.objectContaining({
        statusCode: 413,
        code: 'PAYLOAD_TOO_WIDE',
      }),
    );
  });

  it('rejects dangerous object keys used in prototype pollution payloads', () => {
    const payload = JSON.parse('{"__proto__":{"admin":true}}') as Record<string, unknown>;

    expect(inspectPayloadValue(payload)).toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: 'PAYLOAD_DANGEROUS_KEY',
      }),
    );
  });

  it('rejects oversized string values', () => {
    expect(
      inspectPayloadValue({
        token: 'x'.repeat(PAYLOAD_PROTECTION_LIMITS.maxStringBytes + 1),
      }),
    ).toEqual(
      expect.objectContaining({
        statusCode: 413,
        code: 'PAYLOAD_STRING_TOO_LARGE',
      }),
    );
  });

  it('times out slow body reads before they can keep the connection open indefinitely', () => {
    jest.useFakeTimers();

    const middleware = createRequestBodyTimeoutMiddleware();
    const req = createMockEmitterRequest({
      method: 'POST',
      originalUrl: '/api/auth/login',
    });
    const res = createMockEmitterResponse();
    const next = jest.fn();

    middleware(req as any, res as any, next);
    jest.advanceTimersByTime(5_100);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(408);
    expect(req.destroy).toHaveBeenCalled();

    jest.useRealTimers();
  });
});

function createMockEmitterRequest(input: { method: string; originalUrl: string }) {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();

  return {
    ...input,
    url: input.originalUrl,
    path: input.originalUrl,
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      const bucket = listeners.get(event) || [];
      bucket.push(handler);
      listeners.set(event, bucket);
      return undefined;
    }),
    off: jest.fn((event: string, handler: (...args: any[]) => void) => {
      const bucket = listeners.get(event) || [];
      listeners.set(
        event,
        bucket.filter((entry) => entry !== handler),
      );
      return undefined;
    }),
    destroy: jest.fn(),
  };
}

function createMockEmitterResponse() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();

  return {
    headersSent: false,
    status,
    json,
    on: jest.fn(),
    off: jest.fn(),
  };
}
