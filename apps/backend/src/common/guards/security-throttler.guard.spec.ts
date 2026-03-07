import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { SecurityThrottlerGuard } from './security-throttler.guard';

describe('SecurityThrottlerGuard identity resolution', () => {
  const options = [{ name: 'default', ttl: 60000, limit: 100 }] as any;
  const securityConfigService = {
    getRateLimitConfig: jest.fn().mockResolvedValue({
      enabled: true,
      requests: 100,
      window: 1,
      isProduction: false,
    }),
  };
  const auditService = {
    log: jest.fn(),
  };
  const rateLimitMetricsService = {
    record: jest.fn(),
  };
  const systemTelemetryService = {
    recordSecurityEvent: jest.fn(),
  };

  const createGuard = () =>
    new SecurityThrottlerGuard(
      options,
      new ThrottlerStorageService(),
      new Reflector(),
      securityConfigService as any,
      auditService as any,
      rateLimitMetricsService as any,
      systemTelemetryService as any,
    );

  it('uses tenant:user tracker when request is authenticated', () => {
    const guard = createGuard();
    const identity = (guard as any).resolveThrottleIdentity({
      originalUrl: '/api/users',
      ip: '10.0.0.10',
      user: { id: 'user-1', tenantId: 'tenant-1' },
    });

    expect(identity.scope).toBe('tenant-user');
    expect(identity.tracker).toBe('tenant:tenant-1:user:user-1');
  });

  it('uses IP+target tracker for login routes to reduce shared-IP false positives', () => {
    const guard = createGuard();
    const identity = (guard as any).resolveThrottleIdentity({
      originalUrl: '/api/auth/login',
      ip: '10.0.0.20',
      body: { email: 'admin@example.com' },
    });

    expect(identity.scope).toBe('ip');
    expect(identity.tracker.startsWith('ip:10.0.0.20:target:')).toBe(true);
  });
});

