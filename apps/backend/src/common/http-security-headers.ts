import type { NextFunction, Request, Response } from 'express';
import type { HelmetOptions } from 'helmet';
import { ConfigResolverService } from '../system-settings/config-resolver.service';
import { SettingsRegistry } from '../system-settings/settings-registry.service';
import { ResolvedSetting } from '../system-settings/system-settings.types';
import { readEnvValueForSetting } from '../system-settings/system-settings-value.utils';

export interface SecurityHeadersRuntimeOptions {
  isProduction: boolean;
  frontendUrl?: string;
  enabled: boolean;
}

const SECURITY_HEADERS_KEY = 'security.headers.enabled';

type ConfigResolverLike = Pick<ConfigResolverService, 'getResolved'>;
type SettingsRegistryLike = Pick<SettingsRegistry, 'getOrThrow'>;
type WarnLoggerLike = Pick<Console, 'warn'>;

export async function resolveSecurityHeadersSetting(
  settingsRegistry: SettingsRegistryLike,
  configResolver?: ConfigResolverLike | null,
  logger?: WarnLoggerLike,
): Promise<ResolvedSetting<boolean>> {
  const definition = settingsRegistry.getOrThrow<boolean>(SECURITY_HEADERS_KEY);

  if (configResolver) {
    try {
      const resolved = await configResolver.getResolved<boolean>(SECURITY_HEADERS_KEY);
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      logger?.warn(
        `[security.headers.enabled] Failed to resolve dynamic setting from ConfigResolverService. Falling back to ENV/default. Cause: ${stringifyError(error)}`,
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

export function buildSecurityHeadersHelmetOptions({
  isProduction,
  frontendUrl,
  enabled,
}: SecurityHeadersRuntimeOptions): HelmetOptions {
  return {
    // Mantido fora do toggle para nao colapsar security.headers.enabled com CSP.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          'https:',
          'blob:',
          'http://localhost:4000',
          'https://localhost:4000',
          'http://localhost:5000',
          'https://localhost:5000',
          'http://localhost:3000',
          'https://localhost:3000',
        ],
        connectSrc: [
          "'self'",
          'http://localhost:4000',
          'https://localhost:4000',
          'http://localhost:5000',
          'https://localhost:5000',
          'http://localhost:3000',
          'https://localhost:3000',
          'ws://localhost:4000',
          'wss://localhost:4000',
          'ws://localhost:5000',
          'wss://localhost:5000',
          isProduction ? frontendUrl || '' : '',
        ].filter(Boolean),
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: enabled && isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    frameguard: enabled
      ? {
          action: 'deny',
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    noSniff: enabled,
    hidePoweredBy: enabled,
    dnsPrefetchControl: enabled
      ? {
          allow: false,
        }
      : false,
    ieNoOpen: enabled,
    referrerPolicy: enabled
      ? {
          policy: 'strict-origin-when-cross-origin',
        }
      : false,
  };
}

export function createAdditionalSecurityHeadersMiddleware(enabled: boolean) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (enabled) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Origin-Agent-Cluster', '?1');
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    next();
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
