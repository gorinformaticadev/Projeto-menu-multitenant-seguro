import { gunzipSync } from 'node:zlib';
import { ResponseProtectionMiddleware } from './response-protection.middleware';

function createMockResponse() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let sentBody: unknown = undefined;
  let headersSent = false;

  const response = {
    locals: {},
    get statusCode() {
      return statusCode;
    },
    get sentBody() {
      return sentBody;
    },
    get headersSent() {
      return headersSent;
    },
    set headersSent(value: boolean) {
      headersSent = value;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    removeHeader(name: string) {
      headers.delete(name.toLowerCase());
      return this;
    },
    append(name: string, value: string) {
      const key = name.toLowerCase();
      const current = headers.get(key);
      headers.set(key, current ? `${current}, ${value}` : value);
      return this;
    },
    send(body: unknown) {
      sentBody = body;
      return this;
    },
    json(body: unknown) {
      sentBody = body;
      return this;
    },
  };

  return response as any;
}

describe('response protection middleware', () => {
  it('compresses json responses when the client accepts gzip', () => {
    const middleware = new ResponseProtectionMiddleware();
    const req = {
      method: 'GET',
      originalUrl: '/api/system/dashboard',
      headers: {
        'accept-encoding': 'gzip, deflate',
      },
    } as any;
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    res.json({
      generatedAt: new Date().toISOString(),
      responseTimeMs: 10,
      widgets: { available: ['version'] },
      payload: 'x'.repeat(4_000),
    });

    expect(res.getHeader('content-encoding')).toBe('gzip');
    expect(res.getHeader('vary')).toContain('Accept-Encoding');
    expect(Buffer.isBuffer(res.sentBody)).toBe(true);

    const inflated = JSON.parse(gunzipSync(res.sentBody as Buffer).toString('utf8'));
    expect(inflated.payload).toHaveLength(4_000);
  });

  it('fails closed when a json response exceeds the endpoint response limit', () => {
    const middleware = new ResponseProtectionMiddleware();
    const req = {
      method: 'GET',
      originalUrl: '/api/auth/me',
      headers: {},
    } as any;
    const res = createMockResponse();

    middleware.use(req, res, jest.fn());

    res.json({
      user: 'x'.repeat(80 * 1024),
    });

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(String((res.sentBody as Buffer).toString('utf8')))).toEqual(
      expect.objectContaining({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'RESPONSE_TOO_LARGE',
      }),
    );
  });

  it('passes through untouched when headers were already sent', () => {
    const middleware = new ResponseProtectionMiddleware();
    const req = {
      method: 'GET',
      originalUrl: '/api/system/dashboard',
      headers: {},
    } as any;
    const res = createMockResponse();

    middleware.use(req, res, jest.fn());

    res.headersSent = true;
    res.json({ ok: true });

    expect(res.sentBody).toEqual({ ok: true });
    expect(res.getHeader('content-length')).toBeUndefined();
  });
});
