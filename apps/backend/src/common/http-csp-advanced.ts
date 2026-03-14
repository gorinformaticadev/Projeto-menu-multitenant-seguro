import { ConfigResolverService } from '../system-settings/config-resolver.service';
import { SettingsRegistry } from '../system-settings/settings-registry.service';
import { ResolvedSetting } from '../system-settings/system-settings.types';
import { readEnvValueForSetting } from '../system-settings/system-settings-value.utils';

export interface AdvancedCspHeaderOptions {
  nonce: string;
  isProduction: boolean;
  frontendUrl?: string;
  sentryDsn?: string;
}

const ADVANCED_CSP_KEY = 'security.csp_advanced.enabled';

type ConfigResolverLike = Pick<ConfigResolverService, 'getResolved'>;
type SettingsRegistryLike = Pick<SettingsRegistry, 'getOrThrow'>;
type WarnLoggerLike = { warn(message: string): void };

export async function resolveAdvancedCspSetting(
  settingsRegistry: SettingsRegistryLike,
  configResolver?: ConfigResolverLike | null,
  logger?: WarnLoggerLike,
): Promise<ResolvedSetting<boolean>> {
  const definition = settingsRegistry.getOrThrow<boolean>(ADVANCED_CSP_KEY);

  if (configResolver) {
    try {
      const resolved = await configResolver.getResolved<boolean>(ADVANCED_CSP_KEY);
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      logger?.warn(
        `[security.csp_advanced.enabled] Failed to resolve dynamic setting from ConfigResolverService. Falling back to ENV/default. Cause: ${stringifyError(error)}`,
      );
    }
  }

  const envResolved = readEnvValueForSetting(definition);
  if (envResolved.present && envResolved.ok) {
    return {
      key: definition.key,
      value: envResolved.value as boolean,
      source: 'env',
      definition,
    };
  }

  return {
    key: definition.key,
    value: definition.defaultValue,
    source: 'default',
    definition,
  };
}

export function buildAdvancedCspHeaderValue({
  nonce,
  isProduction,
  frontendUrl,
  sentryDsn,
}: AdvancedCspHeaderOptions): string {
  const resolvedFrontendUrl = frontendUrl || 'http://localhost:5000';
  const cspDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, sentryDsn ? 'https://*.sentry.io' : ''].filter(Boolean),
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'blob:',
      isProduction ? '' : 'http://localhost:4000',
      isProduction ? '' : 'https://localhost:4000',
    ].filter(Boolean),
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': [
      "'self'",
      resolvedFrontendUrl,
      sentryDsn ? 'https://*.sentry.io' : '',
      isProduction ? '' : 'http://localhost:4000',
      isProduction ? '' : 'https://localhost:4000',
      isProduction ? '' : 'http://localhost:5000',
      isProduction ? '' : 'https://localhost:5000',
    ].filter(Boolean),
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    ...(isProduction ? { 'upgrade-insecure-requests': [] } : {}),
    'report-uri': ['/api/csp-report'],
  };

  return Object.entries(cspDirectives)
    .map(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        return `${key} ${values.join(' ')}`;
      }

      if (Array.isArray(values) && values.length === 0) {
        return key;
      }

      return null;
    })
    .filter(Boolean)
    .join('; ');
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
