import * as express from 'express';
import helmet from 'helmet';
import * as request from 'supertest';
import {
  buildSecurityHeadersHelmetOptions,
  createAdditionalSecurityHeadersMiddleware,
  resolveSecurityHeadersSetting,
} from './http-security-headers';
import { SettingsRegistry } from '../system-settings/settings-registry.service';

describe('HTTP security headers dynamic setting', () => {
  const registry = new SettingsRegistry();

  afterEach(() => {
    delete process.env.SECURITY_HEADERS_ENABLED;
  });

  function createApp(enabled: boolean, isProduction = false) {
    const app = express();

    app.use(
      helmet(
        buildSecurityHeadersHelmetOptions({
          enabled,
          isProduction,
          frontendUrl: 'https://painel.exemplo.com',
        }),
      ),
    );
    app.use(createAdditionalSecurityHeadersMiddleware(enabled));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    return app;
  }

  function makeResolved(value: boolean, source: 'database' | 'env' | 'default') {
    return {
      key: 'security.headers.enabled',
      value,
      source,
      definition: registry.getOrThrow<boolean>('security.headers.enabled'),
    };
  }

  it('usa valor vindo do banco quando houver override', async () => {
    const resolver = {
      getResolved: jest.fn().mockResolvedValue(makeResolved(false, 'database')),
    };

    const result = await resolveSecurityHeadersSetting(registry, resolver);

    expect(result.source).toBe('database');
    expect(result.value).toBe(false);
  });

  it('mantem comportamento via ENV quando nao houver override ou apos restore fallback', async () => {
    const resolver = {
      getResolved: jest.fn().mockResolvedValue(makeResolved(false, 'env')),
    };

    const result = await resolveSecurityHeadersSetting(registry, resolver);

    expect(result.source).toBe('env');
    expect(result.value).toBe(false);
  });

  it('usa default quando ENV estiver ausente', async () => {
    const resolver = {
      getResolved: jest.fn().mockResolvedValue(makeResolved(true, 'default')),
    };

    const result = await resolveSecurityHeadersSetting(registry, resolver);

    expect(result.source).toBe('default');
    expect(result.value).toBe(true);
  });

  it('continua fail-open com fallback para ENV quando o banco estiver indisponivel', async () => {
    process.env.SECURITY_HEADERS_ENABLED = 'false';
    const warn = jest.fn();
    const resolver = {
      getResolved: jest.fn().mockRejectedValue(new Error('db offline')),
    };

    const result = await resolveSecurityHeadersSetting(registry, resolver, { warn });

    expect(result.source).toBe('env');
    expect(result.value).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to ENV/default'),
    );
  });

  it('aplica apenas os headers extras controlados pela flag quando habilitado', async () => {
    const response = await request(createApp(true)).get('/ping');

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['cross-origin-opener-policy']).toBe('unsafe-none');
    expect(response.headers['cross-origin-embedder-policy']).toBe('unsafe-none');
    expect(response.headers['origin-agent-cluster']).toBe('?1');
  });

  it('aplica HSTS em producao quando a flag estiver habilitada', async () => {
    const response = await request(createApp(true, true)).get('/ping');

    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('desabilita apenas os headers extras da flag e mantem CSP separado', async () => {
    const response = await request(createApp(false, true)).get('/ping');

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['x-frame-options']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBeUndefined();
    expect(response.headers['referrer-policy']).toBeUndefined();
    expect(response.headers['cross-origin-opener-policy']).toBeUndefined();
    expect(response.headers['cross-origin-embedder-policy']).toBeUndefined();
    expect(response.headers['origin-agent-cluster']).toBeUndefined();
  });
});
