import { ResponseTimeMetricsService } from './system-response-time-metrics.service';

describe('ResponseTimeMetricsService', () => {
  let service: ResponseTimeMetricsService;

  beforeEach(() => {
    service = new ResponseTimeMetricsService();
  });

  it('keeps averages isolated by category', () => {
    service.record(50, 'business');
    service.record(100, 'business');
    service.record(10, 'system');
    service.record(5, 'health');

    const business = service.getAverageForWindow(60_000, 'business');
    const system = service.getAverageForWindow(60_000, 'system');
    const health = service.getAverageForWindow(60_000, 'health');

    expect(business.averageMs).toBe(75);
    expect(business.sampleSize).toBe(2);
    expect(system.averageMs).toBe(10);
    expect(system.sampleSize).toBe(1);
    expect(health.averageMs).toBe(5);
    expect(health.sampleSize).toBe(1);
  });

  it('caps category memory to a bounded sample size', () => {
    for (let index = 0; index < 1600; index += 1) {
      service.record(index, 'business');
    }

    const snapshot = service.getAverageForWindow(30 * 60 * 1000, 'business');
    expect(snapshot.sampleSize).toBeLessThanOrEqual(1200);
  });

  it('returns categorized averages snapshot', () => {
    service.record(80, 'business');
    service.record(30, 'system');

    const categorized = service.getCategorizedAverages(60_000);

    expect(categorized.business.averageMs).toBe(80);
    expect(categorized.system.averageMs).toBe(30);
    expect(categorized.health.averageMs).toBeNull();
  });
});
