export const API_VERSION_HEADER = "x-api-version";
export const API_LATEST_VERSION_HEADER = "x-api-latest-version";
export const API_SUPPORTED_VERSIONS_HEADER = "x-api-supported-versions";
export const API_DEPRECATED_HEADER = "x-api-deprecated";
export const API_DEFAULT_VERSION = "1";
export const API_CURRENT_VERSION = "2";
export const API_SUPPORTED_VERSIONS = [API_DEFAULT_VERSION, API_CURRENT_VERSION] as const;
export type ApiVersion = (typeof API_SUPPORTED_VERSIONS)[number];

export const API_VERSIONING_DOCS_PATH = "/api/versioning";

export const API_VERSION_DEPRECATIONS: Record<
  ApiVersion,
  | {
      deprecated: true;
      successorVersion: ApiVersion;
      sunsetAt: string;
      warning: string;
    }
  | {
      deprecated: false;
    }
> = {
  "1": {
    deprecated: true,
    successorVersion: "2",
    sunsetAt: "2026-09-30T00:00:00.000Z",
    warning: "API v1 esta obsoleta. Migre para x-api-version: 2 antes do sunset.",
  },
  "2": {
    deprecated: false,
  },
};
