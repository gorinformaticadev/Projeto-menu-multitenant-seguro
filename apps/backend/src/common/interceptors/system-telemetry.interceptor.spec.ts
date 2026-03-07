import { BadRequestException, CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { SystemTelemetryInterceptor } from './system-telemetry.interceptor';

describe('SystemTelemetryInterceptor', () => {
  const systemTelemetryServiceMock = {
    recordRequest: jest.fn(),
  };

  const createContext = (method: string, originalUrl: string, statusCode = 200): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method, originalUrl, res: { statusCode } }),
      }),
    }) as ExecutionContext;

  const createNext = (error?: Error): CallHandler =>
    ({
      handle: () => (error ? throwError(() => error) : of('ok')),
    }) as CallHandler;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records normalized request metrics for successful api routes', async () => {
    const interceptor = new SystemTelemetryInterceptor(systemTelemetryServiceMock as any);

    await lastValueFrom(interceptor.intercept(createContext('GET', '/api/users/123', 201), createNext()));

    expect(systemTelemetryServiceMock.recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/users/:id',
        statusCode: 201,
      }),
    );
  });

  it('ignores excluded dashboard polling routes', async () => {
    const interceptor = new SystemTelemetryInterceptor(systemTelemetryServiceMock as any);

    await lastValueFrom(
      interceptor.intercept(createContext('GET', '/api/system/dashboard?periodMinutes=60'), createNext()),
    );

    expect(systemTelemetryServiceMock.recordRequest).not.toHaveBeenCalled();
  });

  it('records error responses with the http status code', async () => {
    const interceptor = new SystemTelemetryInterceptor(systemTelemetryServiceMock as any);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          createContext('POST', '/api/orders/100', 500),
          createNext(new BadRequestException('invalid order')),
        ),
      ),
    ).rejects.toThrow('invalid order');

    expect(systemTelemetryServiceMock.recordRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/orders/:id',
        statusCode: 400,
      }),
    );
  });
});
