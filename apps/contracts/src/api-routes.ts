import { authPaths } from "./auth";
import { dashboardPaths } from "./dashboard";
import type { ApiVersion } from "./http";

export type RequestContractLimits = {
  jsonBytes: number;
  urlencodedBytes: number;
  multipartBytes: number;
  bodyTimeoutMs: number;
  maxDepth: number;
  maxArrayLength: number;
  maxObjectKeys: number;
  maxNodes: number;
  maxStringBytes: number;
  maxKeyBytes: number;
};

export type ResponseContractPolicy = {
  maxBytes: number;
  compressionThresholdBytes: number;
  compress: boolean;
  overflowStatusCode: 413 | 422;
  executionTimeoutMs: number;
};

export type SharedApiRouteContractPolicy = {
  id: string;
  patterns: string[];
  request?: Partial<RequestContractLimits>;
  response?: Partial<ResponseContractPolicy>;
  supportedVersions?: readonly ApiVersion[];
};

export type ResolvedApiRouteContractPolicy = {
  id: string;
  patterns: string[];
  request: RequestContractLimits;
  response: ResponseContractPolicy;
  supportedVersions: readonly ApiVersion[];
};

export const DEFAULT_REQUEST_CONTRACT_LIMITS: RequestContractLimits = {
  jsonBytes: 64 * 1024,
  urlencodedBytes: 16 * 1024,
  multipartBytes: 8 * 1024 * 1024,
  bodyTimeoutMs: 10_000,
  maxDepth: 12,
  maxArrayLength: 200,
  maxObjectKeys: 200,
  maxNodes: 5_000,
  maxStringBytes: 8 * 1024,
  maxKeyBytes: 256,
};

export const DEFAULT_RESPONSE_CONTRACT_POLICY: ResponseContractPolicy = {
  maxBytes: 128 * 1024,
  compressionThresholdBytes: 1024,
  compress: true,
  overflowStatusCode: 413,
  executionTimeoutMs: 12_000,
};

export const SHARED_API_ROUTE_CONTRACT_POLICIES: SharedApiRouteContractPolicy[] = [
  {
    id: "auth",
    patterns: ["/auth/*"],
    supportedVersions: ["1", "2"],
    request: {
      jsonBytes: 8 * 1024,
      urlencodedBytes: 8 * 1024,
      bodyTimeoutMs: 5_000,
      maxDepth: 8,
      maxArrayLength: 24,
      maxObjectKeys: 32,
      maxNodes: 256,
      maxStringBytes: 2 * 1024,
    },
    response: {
      maxBytes: 64 * 1024,
      compressionThresholdBytes: 768,
      executionTimeoutMs: 8_000,
    },
  },
  {
    id: "dashboard-aggregate",
    patterns: [dashboardPaths.aggregate],
    supportedVersions: ["1", "2"],
    request: {
      jsonBytes: 12 * 1024,
      urlencodedBytes: 4 * 1024,
      bodyTimeoutMs: 4_000,
      maxDepth: 8,
      maxArrayLength: 32,
      maxObjectKeys: 32,
      maxNodes: 512,
    },
    response: {
      maxBytes: 384 * 1024,
      compressionThresholdBytes: 1536,
      executionTimeoutMs: 6_000,
    },
  },
  {
    id: "dashboard-layout",
    patterns: [dashboardPaths.layout, dashboardPaths.moduleCards],
    supportedVersions: ["1", "2"],
    request: {
      jsonBytes: 64 * 1024,
      bodyTimeoutMs: 6_000,
      maxDepth: 10,
      maxArrayLength: 96,
      maxObjectKeys: 96,
      maxNodes: 2_000,
    },
    response: {
      maxBytes: 192 * 1024,
      compressionThresholdBytes: 1024,
      executionTimeoutMs: 8_000,
    },
  },
  {
    id: "tenants",
    patterns: [
      "/tenants",
      "/tenants/*",
      "/tenants/*/modules/*",
      "/tenants/my-tenant",
      "/tenants/my-tenant/modules/*",
      "/tenants/public/*",
    ],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 96 * 1024,
      multipartBytes: 12 * 1024 * 1024,
      bodyTimeoutMs: 20_000,
      maxDepth: 10,
      maxArrayLength: 128,
      maxObjectKeys: 128,
      maxNodes: 3_000,
    },
    response: {
      maxBytes: 256 * 1024,
      executionTimeoutMs: 15_000,
    },
  },
  {
    id: "users",
    patterns: ["/users", "/users/*", "/users/tenant/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 96 * 1024,
      multipartBytes: 10 * 1024 * 1024,
      bodyTimeoutMs: 20_000,
      maxDepth: 10,
      maxArrayLength: 128,
      maxObjectKeys: 128,
      maxNodes: 3_000,
    },
    response: {
      maxBytes: 256 * 1024,
      executionTimeoutMs: 15_000,
    },
  },
  {
    id: "notifications",
    patterns: ["/notifications", "/notifications/*", "/system/notifications", "/system/notifications/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 32 * 1024,
      bodyTimeoutMs: 8_000,
      maxDepth: 8,
      maxArrayLength: 128,
      maxNodes: 2_000,
    },
    response: {
      maxBytes: 256 * 1024,
      compressionThresholdBytes: 768,
      executionTimeoutMs: 10_000,
    },
  },
  {
    id: "security-email-config",
    patterns: ["/security-config", "/security-config/*", "/email-config", "/email-config/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 48 * 1024,
      bodyTimeoutMs: 10_000,
      maxDepth: 10,
      maxArrayLength: 64,
      maxNodes: 1_500,
    },
    response: {
      maxBytes: 160 * 1024,
      executionTimeoutMs: 12_000,
    },
  },
  {
    id: "platform-config",
    patterns: ["/platform-config", "/platform-config/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 48 * 1024,
      multipartBytes: 12 * 1024 * 1024,
      bodyTimeoutMs: 20_000,
      maxDepth: 10,
      maxNodes: 1_500,
    },
    response: {
      maxBytes: 160 * 1024,
      executionTimeoutMs: 15_000,
    },
  },
  {
    id: "cron-system-settings",
    patterns: ["/cron", "/cron/*", "/system/settings/*", "/configuracoes/sistema/modulos", "/configuracoes/sistema/modulos/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 48 * 1024,
      multipartBytes: 96 * 1024 * 1024,
      bodyTimeoutMs: 60_000,
      maxDepth: 10,
      maxArrayLength: 64,
      maxNodes: 2_000,
    },
    response: {
      maxBytes: 192 * 1024,
      executionTimeoutMs: 20_000,
    },
  },
  {
    id: "backup-update-audit",
    patterns: ["/backups", "/backups/*", "/backup/create", "/backup/available", "/backup/upload", "/backup/restore", "/backup/restore-logs/*", "/backup/logs", "/backup/download-file/*", "/backup/delete/*", "/update/*", "/system/update/*", "/audit-logs", "/audit-logs/*", "/system/audit", "/system/audit/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 48 * 1024,
      multipartBytes: 256 * 1024 * 1024,
      bodyTimeoutMs: 90_000,
      maxDepth: 10,
      maxArrayLength: 256,
      maxObjectKeys: 256,
      maxNodes: 4_000,
      maxStringBytes: 16 * 1024,
    },
    response: {
      maxBytes: 512 * 1024,
      compressionThresholdBytes: 1536,
      executionTimeoutMs: 60_000,
    },
  },
  {
    id: "modules",
    patterns: ["/modules", "/modules/*", "/tenants/*/modules/*", "/tenants/my-tenant/modules/*", "/me/modules/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 64 * 1024,
      bodyTimeoutMs: 15_000,
      maxDepth: 8,
      maxArrayLength: 96,
      maxObjectKeys: 96,
      maxNodes: 2_000,
    },
    response: {
      maxBytes: 256 * 1024,
      compressionThresholdBytes: 1024,
      executionTimeoutMs: 15_000,
    },
  },
  {
    id: "system-ops",
    patterns: ["/system/version", "/system/maintenance", "/system/maintenance/*", "/system/diagnostics", "/system/diagnostics/*", "/system/retention", "/system/retention/*", "/health", "/health/ping", "/health/websocket", "/csp-report"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 24 * 1024,
      bodyTimeoutMs: 6_000,
      maxDepth: 6,
      maxArrayLength: 32,
      maxObjectKeys: 32,
      maxNodes: 512,
    },
    response: {
      maxBytes: 160 * 1024,
      compressionThresholdBytes: 512,
      executionTimeoutMs: 10_000,
    },
  },
  {
    id: "misc-features",
    patterns: ["/modelo", "/modelo/*", "/secure-files", "/secure-files/*"],
    supportedVersions: ["2"],
    request: {
      jsonBytes: 48 * 1024,
      bodyTimeoutMs: 10_000,
      maxDepth: 8,
      maxArrayLength: 64,
      maxObjectKeys: 64,
      maxNodes: 1_000,
    },
    response: {
      maxBytes: 192 * 1024,
      compressionThresholdBytes: 768,
      executionTimeoutMs: 12_000,
    },
  },
];

export function normalizeApiContractPath(rawPath: string): string {
  const [pathWithoutQuery] = String(rawPath || "/").split("?");
  const normalized =
    pathWithoutQuery.startsWith("/") ? pathWithoutQuery : `/${pathWithoutQuery}`;

  if (normalized === "/api") {
    return "/";
  }

  return normalized.startsWith("/api/") ? normalized.slice(4) : normalized;
}

export function doesApiContractPatternMatch(path: string, pattern: string): boolean {
  const normalizedPath = normalizeApiContractPath(path);
  const normalizedPattern = normalizeApiContractPath(pattern);
  const escapedPattern = normalizedPattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  const regex = new RegExp(`^${escapedPattern.replace(/\*/g, ".*")}$`);
  return regex.test(normalizedPath);
}

export function resolveApiRouteContractPolicy(path: string): ResolvedApiRouteContractPolicy {
  const matchedPolicy =
    SHARED_API_ROUTE_CONTRACT_POLICIES.find((policy) =>
      policy.patterns.some((pattern) => doesApiContractPatternMatch(path, pattern)),
    ) || null;

  return {
    id: matchedPolicy?.id || "default",
    patterns: matchedPolicy?.patterns || [],
    request: {
      ...DEFAULT_REQUEST_CONTRACT_LIMITS,
      ...(matchedPolicy?.request || {}),
    },
    response: {
      ...DEFAULT_RESPONSE_CONTRACT_POLICY,
      ...(matchedPolicy?.response || {}),
    },
    supportedVersions: matchedPolicy?.supportedVersions || ["1", "2"],
  };
}
