import {
  API_CURRENT_VERSION,
  API_DEFAULT_VERSION,
  API_DEPRECATED_HEADER,
  API_LATEST_VERSION_HEADER,
  API_SUPPORTED_VERSIONS,
  API_SUPPORTED_VERSIONS_HEADER,
  API_VERSION_DEPRECATIONS,
  API_VERSION_HEADER,
  API_VERSIONING_DOCS_PATH,
  type ApiVersion,
} from '@contracts/http';

export type SupportedApiVersionResolution = {
  ok: true;
  requestedVersion: string | null;
  resolvedVersion: ApiVersion;
  supportedVersions: readonly ApiVersion[];
  latestVersion: ApiVersion;
  wasDefaulted: boolean;
  isDeprecated: boolean;
  successorVersion?: ApiVersion;
  sunsetAt?: string;
  warning?: string;
};

export type UnsupportedApiVersionResolution = {
  ok: false;
  requestedVersion: string;
  supportedVersions: readonly ApiVersion[];
  latestVersion: ApiVersion;
};

export type ApiVersionResolution =
  | SupportedApiVersionResolution
  | UnsupportedApiVersionResolution;

export function normalizeRequestedApiVersion(rawValue: unknown): string | null {
  if (Array.isArray(rawValue)) {
    return normalizeRequestedApiVersion(rawValue[0]);
  }

  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isSupportedApiVersion(value: string): value is ApiVersion {
  return (API_SUPPORTED_VERSIONS as readonly string[]).includes(value);
}

export function resolveApiVersion(
  rawValue: unknown,
  supportedVersions: readonly ApiVersion[] = API_SUPPORTED_VERSIONS,
): ApiVersionResolution {
  const requestedVersion = normalizeRequestedApiVersion(rawValue);
  const normalizedSupportedVersions =
    supportedVersions.length > 0 ? supportedVersions : API_SUPPORTED_VERSIONS;
  const routeLatestVersion =
    normalizedSupportedVersions[normalizedSupportedVersions.length - 1] || API_CURRENT_VERSION;
  const routeDefaultVersion = normalizedSupportedVersions.includes(API_DEFAULT_VERSION)
    ? API_DEFAULT_VERSION
    : routeLatestVersion;

  if (!requestedVersion) {
    return buildSupportedResolution(routeDefaultVersion, null, true, normalizedSupportedVersions);
  }

  if (
    !isSupportedApiVersion(requestedVersion) ||
    !normalizedSupportedVersions.includes(requestedVersion)
  ) {
    return {
      ok: false,
      requestedVersion,
      supportedVersions: normalizedSupportedVersions,
      latestVersion: routeLatestVersion,
    };
  }

  return buildSupportedResolution(
    requestedVersion,
    requestedVersion,
    false,
    normalizedSupportedVersions,
  );
}

export function buildApiVersionResponseHeaders(
  resolution: SupportedApiVersionResolution,
): Record<string, string> {
  const headers: Record<string, string> = {
    [API_VERSION_HEADER]: resolution.resolvedVersion,
    [API_LATEST_VERSION_HEADER]: resolution.latestVersion,
    [API_SUPPORTED_VERSIONS_HEADER]: resolution.supportedVersions.join(', '),
    [API_DEPRECATED_HEADER]: resolution.isDeprecated ? 'true' : 'false',
    Vary: API_VERSION_HEADER,
  };

  if (!resolution.isDeprecated) {
    return headers;
  }

  const successor = resolution.successorVersion || API_CURRENT_VERSION;
  const sunsetAt = resolution.sunsetAt ? new Date(resolution.sunsetAt).toUTCString() : undefined;
  headers.Deprecation = 'true';
  if (sunsetAt) {
    headers.Sunset = sunsetAt;
  }
  headers.Warning = `299 - "${resolution.warning || `API version ${resolution.resolvedVersion} is deprecated.`}"`;
  headers.Link = `<${API_VERSIONING_DOCS_PATH}#v${successor}>; rel="successor-version"`;

  return headers;
}

function buildSupportedResolution(
  resolvedVersion: ApiVersion,
  requestedVersion: string | null,
  wasDefaulted: boolean,
  supportedVersions: readonly ApiVersion[],
): SupportedApiVersionResolution {
  const deprecation = API_VERSION_DEPRECATIONS[resolvedVersion];
  const latestVersion = supportedVersions[supportedVersions.length - 1] || API_CURRENT_VERSION;

  if (deprecation.deprecated) {
    return {
      ok: true,
      requestedVersion,
      resolvedVersion,
      supportedVersions,
      latestVersion,
      wasDefaulted,
      isDeprecated: true,
      successorVersion: deprecation.successorVersion,
      sunsetAt: deprecation.sunsetAt,
      warning: deprecation.warning,
    };
  }

  return {
    ok: true,
    requestedVersion,
    resolvedVersion,
    supportedVersions,
    latestVersion,
    wasDefaulted,
    isDeprecated: false,
  };
}
