import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_TENANT_LOGO_PATH, resolveTenantLogoSrc } from './tenant-logo';

vi.mock('@/lib/api', () => ({
  API_URL: 'http://localhost:4000/api',
}));

describe('resolveTenantLogoSrc', () => {
  it('converte filename legado para rota de uploads', () => {
    expect(resolveTenantLogoSrc('logo.png')).toBe('http://localhost:4000/uploads/logos/logo.png');
  });

  it('usa endpoint publico por tenant quando tenantId e informado', () => {
    expect(resolveTenantLogoSrc('logo.png', { tenantId: 'tenant-1' })).toBe(
      'http://localhost:4000/api/tenants/public/tenant-1/logo-file',
    );
  });

  it('mantem rota de logo publico por tenant', () => {
    expect(resolveTenantLogoSrc('/api/tenants/public/tenant-1/logo-file')).toBe(
      'http://localhost:4000/api/tenants/public/tenant-1/logo-file',
    );
  });

  it('mantem url absoluta', () => {
    expect(resolveTenantLogoSrc('https://cdn.exemplo.com/logo.png')).toBe('https://cdn.exemplo.com/logo.png');
  });

  it('retorna null quando nao ha logo e fallback nao foi solicitado', () => {
    expect(resolveTenantLogoSrc(null)).toBeNull();
  });

  it('aplica fallback padrao quando nao ha logo e fallback foi solicitado', () => {
    expect(resolveTenantLogoSrc(null, { fallbackToDefault: true })).toBe(
      DEFAULT_TENANT_LOGO_PATH,
    );
  });
});
