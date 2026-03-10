import { API_URL } from '@/lib/api';

type TenantLogoResolveOptions = {
  cacheBuster?: string | number;
  tenantId?: string | null;
  fallbackToDefault?: boolean;
};

export const DEFAULT_TENANT_LOGO_PATH = '/favicon-32x32.png';

function normalizeApiOrigin() {
  if (/^https?:\/\//i.test(API_URL)) {
    return API_URL.replace(/\/api\/?$/i, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

function appendCacheBuster(url: string, cacheBuster?: string | number) {
  if (cacheBuster === undefined || cacheBuster === null) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${encodeURIComponent(String(cacheBuster))}`;
}

function normalizeRelativeLogoPath(value: string, tenantId?: string | null) {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/tenants/public/')) {
    return `/api${raw}`;
  }

  if (raw.startsWith('/api/')) {
    return raw;
  }

  if (raw.startsWith('/uploads/') || raw.startsWith('/logos/')) {
    return raw;
  }

  const safeTenantId = String(tenantId || '').trim();
  if (safeTenantId) {
    return `/api/tenants/public/${encodeURIComponent(safeTenantId)}/logo-file`;
  }

  const fileName = encodeURIComponent(raw);
  return `/uploads/logos/${fileName}`;
}

function parseResolveOptions(
  cacheOrOptions?: string | number | TenantLogoResolveOptions,
  tenantIdArg?: string | null,
) {
  if (cacheOrOptions && typeof cacheOrOptions === 'object') {
    return {
      cacheBuster: cacheOrOptions.cacheBuster,
      tenantId: cacheOrOptions.tenantId ?? null,
      fallbackToDefault: cacheOrOptions.fallbackToDefault ?? false,
    };
  }

  return {
    cacheBuster: cacheOrOptions,
    tenantId: tenantIdArg ?? null,
    fallbackToDefault: false,
  };
}

function toAbsoluteLogoUrl(pathOrUrl: string) {
  if (/^(blob:|data:|https?:\/\/)/i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const apiOrigin = normalizeApiOrigin();
  if (!apiOrigin) {
    return pathOrUrl;
  }

  return `${apiOrigin}${pathOrUrl}`;
}

export function resolveTenantLogoSrc(
  logoUrl?: string | null,
  cacheOrOptions?: string | number | TenantLogoResolveOptions,
  tenantIdArg?: string | null,
) {
  const { cacheBuster, tenantId, fallbackToDefault } = parseResolveOptions(cacheOrOptions, tenantIdArg);
  const normalized = normalizeRelativeLogoPath(String(logoUrl || ''), tenantId);

  if (!normalized) {
    return fallbackToDefault ? DEFAULT_TENANT_LOGO_PATH : null;
  }

  const withCache = appendCacheBuster(normalized, cacheBuster);
  return toAbsoluteLogoUrl(withCache);
}
