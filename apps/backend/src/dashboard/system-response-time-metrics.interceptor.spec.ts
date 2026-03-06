import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { ResponseTimeMetricsInterceptor } from './system-response-time-metrics.interceptor';

describe('ResponseTimeMetricsInterceptor', () => {
  const responseTimeMetricsServiceMock = {
    record: jest.fn(),
  };

  const createContext = (method: string, originalUrl: string): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method, originalUrl }),
      }),
    }) as ExecutionContext;

  const createNext = (withError = false): CallHandler =>
    ({
      handle: () => (withError ? throwError(() => new Error('boom')) : of('ok')),
    }) as CallHandler;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records business api routes', async () => {
    const interceptor = new ResponseTimeMetricsInterceptor(responseTimeMetricsServiceMock as any);

    await lastValueFrom(interceptor.intercept(createContext('GET', '/api/tenants?page=1'), createNext()));

    expect(responseTimeMetricsServiceMock.record).toHaveBeenCalledTimes(1);
    expect(responseTimeMetricsServiceMock.record).toHaveBeenCalledWith(expect.any(Number), 'business');
  });

  it('records health routes in health category', async () => {
    const interceptor = new ResponseTimeMetricsInterceptor(responseTimeMetricsServiceMock as any);

    await lastValueFrom(interceptor.intercept(createContext('GET', '/api/health'), createNext()));

    expect(responseTimeMetricsServiceMock.record).toHaveBeenCalledWith(expect.any(Number), 'health');
  });

  it('records system routes in system category', async () => {
    const interceptor = new ResponseTimeMetricsInterceptor(responseTimeMetricsServiceMock as any);

    await lastValueFrom(interceptor.intercept(createContext('POST', '/api/system/update/run'), createNext()));

    expect(responseTimeMetricsServiceMock.record).toHaveBeenCalledWith(expect.any(Number), 'system');
  });

  it('ignores excluded polling/internal routes', async () => {
    const interceptor = new ResponseTimeMetricsInterceptor(responseTimeMetricsServiceMock as any);

    await lastValueFrom(
      interceptor.intercept(createContext('GET', '/api/system/dashboard?periodMinutes=60'), createNext()),
    );

    expect(responseTimeMetricsServiceMock.record).not.toHaveBeenCalled();
  });

  it('still records on error responses', async () => {
    const interceptor = new ResponseTimeMetricsInterceptor(responseTimeMetricsServiceMock as any);

    await expect(
      lastValueFrom(interceptor.intercept(createContext('GET', '/api/orders'), createNext(true))),
    ).rejects.toThrow('boom');

    expect(responseTimeMetricsServiceMock.record).toHaveBeenCalledWith(expect.any(Number), 'business');
  });
});
