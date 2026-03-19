import { lastValueFrom, of, timer } from 'rxjs';
import { mapTo } from 'rxjs/operators';
import { RouteExecutionTimeoutInterceptor } from './route-execution-timeout.interceptor';

describe('RouteExecutionTimeoutInterceptor', () => {
  it('lets fast requests complete normally', async () => {
    const interceptor = new RouteExecutionTimeoutInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept(createExecutionContext('/api/system/dashboard'), {
        handle: () => of({ ok: true }),
      } as any),
    );

    expect(result).toEqual({ ok: true });
  });

  it('aborts slow handlers with a request-timeout exception', async () => {
    jest.useFakeTimers();

    const interceptor = new RouteExecutionTimeoutInterceptor();
    const pending = lastValueFrom(
      interceptor.intercept(createExecutionContext('/api/system/dashboard'), {
        handle: () => timer(7_000).pipe(mapTo({ ok: true })),
      } as any),
    );

    jest.advanceTimersByTime(7_000);

    await expect(pending).rejects.toMatchObject({
      response: {
        statusCode: 408,
      },
    });

    jest.useRealTimers();
  });
});

function createExecutionContext(originalUrl: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl,
      }),
    }),
  } as any;
}
