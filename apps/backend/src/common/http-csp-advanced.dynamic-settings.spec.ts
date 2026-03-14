import * as express from 'express';
import helmet from 'helmet';
import * as request from 'supertest';
import { CspMiddleware } from './middleware/csp.middleware';
import {
  buildSecurityHeadersHelmetOptions,
  createAdditionalSecurityHeadersMiddleware,
} from './http-security-headers';
import {
  buildAdvancedCspHeaderValue,
  resolveAdvancedCspSetting,
} from './http-csp-advanced';
import { SettingsRegistry } from '../system-settings/settings-registry.service';

describe('Advanced CSP dynamic setting', () => {
  const registry = new SettingsRegistry();
  const cspDefinition = registry.getOrThrow<boolean>('security.csp_advanced.enabled');
  const headersDefinition = registry.getOrThrow<boolean>('security.headers.enabled');
  const originalCspEnv = process.env.CSP_ADVANCED;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalSentryDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    jest.useRealTimers();

    if (originalCspEnv === undefined) {
      delete process.env.CSP_ADVANCED;
    } else {
      process.env.CSP_ADVANCED = originalCspEnv;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }

    if (originalSentryDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalSentryDsn;
    }
  });

  function makeResolved(value: boolean, source: 'database' | 'env' | 'default') {
    return {
      key: cspDefinition.key,
      value,
      source,
      definition: cspDefinition,
    };
  }

  function createResolver(result: ReturnType<typeof makeResolved> | Error | null) {
    return {
      getResolved: jest.fn().mockImplementation(async (key: string) => {
        if (key !== cspDefinition.key) {
          return null;
        }

        if (result instanceof Error) {
          throw result;
        }

        return result;
      }),
    };
  }

  function createApp(options?: {
    advancedResolver?: { getResolved: jest.Mock<Promise<any>, [string]> };
    securityHeadersEnabled?: boolean;
  }) {
    const app = express();
    const middleware = new CspMiddleware(
      registry,
      options?.advancedResolver as any,
    );

    app.use(
      helmet(
        buildSecurityHeadersHelmetOptions({
          enabled: options?.securityHeadersEnabled ?? true,
          isProduction: process.env.NODE_ENV === 'production',
          frontendUrl: process.env.FRONTEND_URL,
        }),
      ),
    );
    app.use(createAdditionalSecurityHeadersMiddleware(options?.securityHeadersEnabled ?? true));
    app.use((req, res, next) => {
      void middleware.use(req as any, res as any, next);
    });
    app.get('/ping', (_req, res) => {
      res.json({
        nonce: res.locals.nonce ?? null,
      });
    });

    return { app, middleware };
  }

  it('usa valor vindo do banco quando houver override', async () => {
    const resolver = createResolver(makeResolved(true, 'database'));

    const result = await resolveAdvancedCspSetting(registry, resolver);

    expect(result.source).toBe('database');
    expect(result.value).toBe(true);
  });

  it('mantem comportamento via ENV quando nao houver override ou apos restore fallback', async () => {
    process.env.CSP_ADVANCED = 'true';
    const resolver = createResolver(null);

    const result = await resolveAdvancedCspSetting(registry, resolver);

    expect(result.source).toBe('env');
    expect(result.value).toBe(true);
  });

  it('usa default quando ENV estiver ausente', async () => {
    delete process.env.CSP_ADVANCED;
    const resolver = createResolver(null);

    const result = await resolveAdvancedCspSetting(registry, resolver);

    expect(result.source).toBe('default');
    expect(result.value).toBe(cspDefinition.defaultValue);
  });

  it('continua fail-open com fallback para ENV quando o banco estiver indisponivel', async () => {
    process.env.CSP_ADVANCED = 'true';
    const warn = jest.fn();
    const resolver = createResolver(new Error('db offline'));

    const result = await resolveAdvancedCspSetting(registry, resolver, { warn });

    expect(result.source).toBe('env');
    expect(result.value).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to ENV/default'));
  });

  it('aplica a CSP avancada quando a flag estiver habilitada', async () => {
    process.env.CSP_ADVANCED = 'true';
    process.env.FRONTEND_URL = 'https://painel.exemplo.com';
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://abc@sentry.io/123';

    const { app } = createApp();
    const response = await request(app).get('/ping');

    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain('nonce-');
    expect(response.headers['content-security-policy']).toContain('/api/csp-report');
    expect(response.headers['content-security-policy']).toContain('https://painel.exemplo.com');
    expect(response.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(response.body.nonce).toEqual(expect.any(String));
  });

  it('desabilita apenas a CSP avancada e mantem a CSP basica separada de security.headers.enabled', async () => {
    delete process.env.CSP_ADVANCED;
    process.env.NODE_ENV = 'production';

    const { app } = createApp({
      securityHeadersEnabled: true,
      advancedResolver: createResolver(makeResolved(false, 'database')),
    });
    const response = await request(app).get('/ping');

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('/api/csp-report');
    expect(response.headers['content-security-policy']).not.toContain('nonce-');
    expect(response.body.nonce).toBeNull();
  });

  it('permite CSP avancada mesmo com security.headers.enabled desligado, preservando a separacao semantica', async () => {
    const { app } = createApp({
      securityHeadersEnabled: false,
      advancedResolver: createResolver(makeResolved(true, 'database')),
    });
    const response = await request(app).get('/ping');

    expect(response.headers['content-security-policy']).toContain('/api/csp-report');
    expect(response.headers['x-frame-options']).toBeUndefined();
    expect(response.headers['referrer-policy']).toBeUndefined();
    expect(response.body.nonce).toEqual(expect.any(String));
  });

  it('restaura o fallback apos expirar o cache local do middleware', async () => {
    jest.useFakeTimers();
    const resolver = {
      getResolved: jest
        .fn()
        .mockResolvedValueOnce(makeResolved(true, 'database'))
        .mockResolvedValueOnce(null),
    };
    const middleware = new CspMiddleware(registry, resolver as any);
    const setHeader = jest.fn();
    const firstResponse = {
      locals: {},
      setHeader,
    } as any;
    const next = jest.fn();

    process.env.CSP_ADVANCED = 'false';
    process.env.NODE_ENV = 'production';

    await middleware.use({} as any, firstResponse, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining('/api/csp-report'),
    );
    expect(next).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 15001);

    const secondSetHeader = jest.fn();
    const secondResponse = {
      locals: {},
      setHeader: secondSetHeader,
    } as any;

    await middleware.use({} as any, secondResponse, next);

    expect(resolver.getResolved).toHaveBeenCalledTimes(2);
    expect(secondSetHeader).not.toHaveBeenCalled();
    expect(secondResponse.locals.nonce).toBeUndefined();
  });

  it('permanece separado de security.headers.enabled e security.csrf.enabled na resolucao dinamica', async () => {
    const configResolver = {
      getResolved: jest.fn().mockResolvedValue(makeResolved(true, 'database')),
    };

    await resolveAdvancedCspSetting(registry, configResolver as any);

    expect(configResolver.getResolved).toHaveBeenCalledWith('security.csp_advanced.enabled');
    expect(configResolver.getResolved).not.toHaveBeenCalledWith(headersDefinition.key);
    expect(configResolver.getResolved).not.toHaveBeenCalledWith('security.csrf.enabled');
  });

  it('preserva o formato legado da politica avancada ao construir o header', () => {
    const header = buildAdvancedCspHeaderValue({
      nonce: 'abc123',
      isProduction: true,
      frontendUrl: 'https://painel.exemplo.com',
      sentryDsn: 'https://abc@sentry.io/123',
    });

    expect(header).toContain("default-src 'self'");
    expect(header).toContain("script-src 'self' 'nonce-abc123'");
    expect(header).toContain('https://*.sentry.io');
    expect(header).toContain('report-uri /api/csp-report');
  });
});
