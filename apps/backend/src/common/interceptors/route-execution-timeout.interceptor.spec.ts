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
        handle: () => timer(11_000).pipe(mapTo({ ok: true })),
      } as any),
    );

    jest.advanceTimersByTime(11_000);

    await expect(pending).rejects.toMatchObject({
      response: {
        statusCode: 408,
      },
    });

    jest.useRealTimers();
  });

  it('preserves the full timeout budget for the operational dashboard under distributed pressure', async () => {
    jest.useFakeTimers();

    const interceptor = new RouteExecutionTimeoutInterceptor(undefined, {
      getSnapshot: () => ({
        adaptiveThrottleFactor: 0.5,
        clusterRecentApiLatencyMs: 2_000,
      }),
    } as any);

    const pending = lastValueFrom(
      interceptor.intercept(createExecutionContext('/api/system/dashboard'), {
        handle: () => timer(7_000).pipe(mapTo({ ok: true })),
      } as any),
    );

    jest.advanceTimersByTime(7_000);

    await expect(pending).resolves.toEqual({ ok: true });

    jest.useRealTimers();
  });

  it('still shrinks the timeout budget under distributed pressure for non-operational routes', async () => {
    jest.useFakeTimers();

    const interceptor = new RouteExecutionTimeoutInterceptor(undefined, {
      getSnapshot: () => ({
        adaptiveThrottleFactor: 0.5,
        clusterRecentApiLatencyMs: 2_000,
      }),
    } as any);

    const pending = lastValueFrom(
      interceptor.intercept(createExecutionContext('/api/ops-runtime-test/rate-limit/ping'), {
        handle: () => timer(4_200).pipe(mapTo({ ok: true })),
      } as any),
    );

    jest.advanceTimersByTime(4_200);

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
