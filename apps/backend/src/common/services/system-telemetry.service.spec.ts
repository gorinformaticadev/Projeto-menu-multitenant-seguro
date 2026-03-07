import { SystemTelemetryService } from './system-telemetry.service';

describe('SystemTelemetryService', () => {
  let service: SystemTelemetryService;

  beforeEach(() => {
    jest.useRealTimers();
    service = new SystemTelemetryService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aggregates top routes while filtering one-off noise from rare endpoints', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T10:00:00.000Z'));

    service.recordRequest({ method: 'GET', route: '/api/users/1', durationMs: 500, statusCode: 200 });
    service.recordRequest({ method: 'GET', route: '/api/users/2', durationMs: 700, statusCode: 500 });
    service.recordRequest({ method: 'GET', route: '/api/users/3', durationMs: 600, statusCode: 200 });
    service.recordRequest({ method: 'POST', route: '/api/admin/export', durationMs: 1200, statusCode: 500 });
    service.recordRequest({ method: 'POST', route: '/api/orders/99', durationMs: 260, statusCode: 422 });
    service.recordRequest({ method: 'POST', route: '/api/orders/100', durationMs: 240, statusCode: 422 });

    const snapshot = service.getApiSnapshot(15 * 60 * 1000, 3);

    expect(snapshot.totalRequestsRecent).toBe(6);
    expect(snapshot.totalErrorCount).toBe(4);
    expect(snapshot.topSlowRoutes[0]).toEqual(
      expect.objectContaining({
        method: 'GET',
        route: '/api/users/:id',
        requestCount: 3,
        avgMs: 600,
        errorCount: 1,
      }),
    );
    expect(snapshot.topErrorRoutes).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ method: 'GET', route: '/api/users/:id', errorCount: 1 })][0],
        [expect.objectContaining({ method: 'POST', route: '/api/orders/:id', errorCount: 2 })][0],
      ]),
    );
    expect(snapshot.topSlowRoutes).not.toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ route: '/api/admin/export' })][0],
      ]),
    );
    expect(snapshot.topErrorRoutes).not.toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ route: '/api/admin/export' })][0],
      ]),
    );
  });

  it('keeps request buffers bounded and prunes expired samples', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T11:00:00.000Z'));

    for (let index = 0; index < 5_100; index += 1) {
      service.recordRequest({
        method: 'GET',
        route: `/api/items/${index}`,
        durationMs: 10 + (index % 5),
        statusCode: 200,
      });
    }

    expect((service as any).requestEvents.length).toBeLessThanOrEqual(5_000);

    jest.advanceTimersByTime(16 * 60 * 1000);
    service.getApiSnapshot(15 * 60 * 1000);

    expect((service as any).requestEvents.length).toBe(0);
  });

  it('aggregates security events by ip with denied, rate limit and bypass counters', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T12:00:00.000Z'));

    service.recordSecurityEvent({
      type: 'forbidden',
      method: 'GET',
      route: '/api/admin/users/1',
      ip: '10.0.0.10',
      statusCode: 403,
    });
    jest.advanceTimersByTime(1_000);
    service.recordSecurityEvent({
      type: 'rate_limited',
      method: 'POST',
      route: '/api/auth/login',
      ip: '10.0.0.20',
      statusCode: 429,
    });
    jest.advanceTimersByTime(1_000);
    service.recordSecurityEvent({
      type: 'maintenance_bypass_attempt',
      method: 'GET',
      route: '/api/system/dashboard',
      ip: '10.0.0.10',
      statusCode: 403,
    });

    const snapshot = service.getSecuritySnapshot(15 * 60 * 1000, 5);

    expect(snapshot.maintenanceBypassAttemptsRecent).toBe(1);
    expect(snapshot.topDeniedIps[0]).toEqual(
      expect.objectContaining({
        ip: '10.0.0.10',
        count: 2,
      }),
    );
    expect(snapshot.topRateLimitedIps[0]).toEqual(
      expect.objectContaining({
        ip: '10.0.0.20',
        count: 1,
      }),
    );
    expect(snapshot.accessDeniedRecent[0]).toEqual(
      expect.objectContaining({
        type: 'maintenance_bypass_attempt',
        route: '/api/system/dashboard',
      }),
    );
  });
  it('uses the longer security retention window by default', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T12:00:00.000Z'));

    jest.setSystemTime(new Date('2026-03-07T07:30:00.000Z'));
    service.recordSecurityEvent({
      type: 'forbidden',
      method: 'GET',
      route: '/api/admin/users/1',
      ip: '10.0.0.10',
      statusCode: 403,
    });

    jest.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));
    const snapshot = service.getSecuritySnapshot();

    expect(snapshot.windowSeconds).toBe(6 * 60 * 60);
    expect(snapshot.topDeniedIps[0]).toEqual(
      expect.objectContaining({
        ip: '10.0.0.10',
        count: 1,
      }),
    );
  });
});
