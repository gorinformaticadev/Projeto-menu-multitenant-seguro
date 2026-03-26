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
    expect(snapshot.total5xxCount).toBe(2);
    expect(snapshot.error5xxRateRecent).toBe(33.33);
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

    jest.advanceTimersByTime(31 * 60 * 1000);
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
    expect(snapshot.unauthorizedCountRecent).toBe(0);
    expect(snapshot.forbiddenCountRecent).toBe(2);
    expect(snapshot.rateLimitedCountRecent).toBe(1);
    expect(snapshot.deniedSpikeCountRecent).toBe(3);
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

  it('agrega anomalias de contrato por minuto, DTO, rota e tenant anonimizado', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T13:00:00.000Z'));

    for (let index = 0; index < 20; index += 1) {
      service.recordRequest({
        method: 'GET',
        route: `/api/users/${index}`,
        durationMs: 80,
        statusCode: 200,
      });
    }

    service.recordContractAnomaly({
      type: 'validation_failed',
      dto: 'UserResponseDto',
      route: '/api/users/:id',
      method: 'GET',
      module: 'users',
      origin: 'http',
      tenantHash: 'tenant-hash-a',
      operationType: 'read',
      detailCount: 2,
    });
    jest.advanceTimersByTime(60_000);
    service.recordContractAnomaly({
      type: 'payload_stripped',
      dto: 'UserResponseDto',
      route: '/api/users/:id',
      method: 'GET',
      module: 'users',
      origin: 'http',
      tenantHash: 'tenant-hash-a',
      operationType: 'read',
      detailCount: 1,
    });
    service.recordContractAnomaly({
      type: 'payload_stripped',
      dto: 'OrderResponseDto',
      route: '/api/orders/:id',
      method: 'GET',
      module: 'orders',
      origin: 'http',
      tenantHash: 'tenant-hash-b',
      operationType: 'read',
      detailCount: 3,
    });

    const snapshot = service.getContractAnomalySnapshot(10 * 60 * 1000);

    expect(snapshot.totalEvents).toBe(3);
    expect(snapshot.totalValidationErrors).toBe(1);
    expect(snapshot.totalPayloadStrips).toBe(2);
    expect(snapshot.failureRatePerThousandRequests).toBe(50);
    expect(snapshot.byDto).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dto: 'UserResponseDto',
          count: 2,
          validationFailed: 1,
          payloadStripped: 1,
        }),
      ]),
    );
    expect(snapshot.byRoute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: '/api/users/:id',
          validationFailed: 1,
          payloadStripped: 1,
          totalRatePerThousandRequests: 100,
        }),
      ]),
    );
    expect(snapshot.byTenant).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantHash: 'tenant-hash-a',
          count: 2,
        }),
      ]),
    );
    expect(snapshot.eventsPerMinute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          total: 1,
          validationFailed: 1,
        }),
        expect.objectContaining({
          total: 2,
          payloadStripped: 2,
        }),
      ]),
    );
  });

  it('detecta aumento percentual de 200% entre a janela atual e a anterior', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T14:00:00.000Z'));

    jest.setSystemTime(new Date('2026-03-07T13:45:00.000Z'));
    for (let index = 0; index < 2; index += 1) {
      service.recordContractAnomaly({
        type: 'payload_stripped',
        dto: 'GrowthDto',
        route: '/api/contracts/:id',
        method: 'GET',
        module: 'contracts',
        origin: 'http',
        tenantHash: 'tenant-growth',
        operationType: 'read',
        detailCount: 1,
      });
    }

    jest.setSystemTime(new Date('2026-03-07T13:55:00.000Z'));
    for (let index = 0; index < 6; index += 1) {
      service.recordContractAnomaly({
        type: 'payload_stripped',
        dto: 'GrowthDto',
        route: '/api/contracts/:id',
        method: 'GET',
        module: 'contracts',
        origin: 'http',
        tenantHash: 'tenant-growth',
        operationType: 'read',
        detailCount: 1,
      });
    }

    jest.setSystemTime(new Date('2026-03-07T14:00:00.000Z'));
    const snapshot = service.getContractAnomalySnapshot(10 * 60 * 1000);

    expect(snapshot.trends.previousPayloadStrips).toBe(2);
    expect(snapshot.trends.payloadIncreasePercent).toBe(200);
    expect(snapshot.severity.trend).toBe('critical');
  });

  it('detecta crescimento continuo por uma hora nas anomalias de contrato', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T14:00:00.000Z'));

    const growthBuckets = [1, 2, 3, 4, 5, 6];
    growthBuckets.forEach((count, bucketIndex) => {
      const bucketStart = new Date(`2026-03-07T13:${String(bucketIndex * 10).padStart(2, '0')}:00.000Z`);
      jest.setSystemTime(bucketStart);
      for (let eventIndex = 0; eventIndex < count; eventIndex += 1) {
        service.recordContractAnomaly({
          type: 'payload_stripped',
          dto: 'GrowthDto',
          route: '/api/contracts/:id',
          method: 'GET',
          module: 'contracts',
          origin: 'http',
          tenantHash: 'tenant-growth',
          operationType: 'read',
          detailCount: 1,
        });
      }
    });

    jest.setSystemTime(new Date('2026-03-07T14:00:00.000Z'));
    const snapshot = service.getContractAnomalySnapshot(10 * 60 * 1000);

    expect(snapshot.trends.continuousGrowthMinutes).toBe(60);
    expect(snapshot.trends.increasingForLastHour).toBe(true);
    expect(snapshot.severity.trend).toBe('critical');
    expect(snapshot.severity.overall).toBe('critical');
  });
});
