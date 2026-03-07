import {
  normalizeTelemetryMethod,
  normalizeTelemetryPath,
  resolveTelemetryRoute,
  shouldCollectRequestTelemetry,
  shouldCollectSecurityTelemetry,
} from './system-telemetry.util';

describe('system-telemetry.util', () => {
  it('normalizes raw api paths without query strings or dynamic ids', () => {
    expect(normalizeTelemetryPath('/api/users/123?search=test')).toBe('/api/users/:id');
    expect(normalizeTelemetryPath('/api/orders/987/items/1')).toBe('/api/orders/:id/items/:id');
    expect(normalizeTelemetryPath('/api/tokens/9f86d081884c7d659a2feaa0c55ad015')).toBe('/api/tokens/:token');
  });

  it('prefers the framework route template when available', () => {
    expect(
      resolveTelemetryRoute({
        baseUrl: '/api/orders',
        route: { path: '/:orderId/items/:itemId' },
      }),
    ).toBe('/api/orders/:orderid/items/:itemid');
  });

  it('skips noisy internal polling routes from request telemetry', () => {
    expect(shouldCollectRequestTelemetry('GET', '/api/system/dashboard')).toBe(false);
    expect(shouldCollectRequestTelemetry('GET', '/api/system/dashboard/module-cards')).toBe(false);
    expect(shouldCollectRequestTelemetry('GET', '/api/system/notifications/stream')).toBe(false);
    expect(shouldCollectRequestTelemetry('GET', '/api/orders/:id')).toBe(true);
  });

  it('keeps security telemetry on sensitive api routes while still excluding pure noise', () => {
    expect(shouldCollectSecurityTelemetry('GET', '/api/system/dashboard')).toBe(true);
    expect(shouldCollectSecurityTelemetry('GET', '/api/system/notifications')).toBe(false);
    expect(shouldCollectSecurityTelemetry(normalizeTelemetryMethod('options'), '/api/orders/:id')).toBe(false);
  });
});
