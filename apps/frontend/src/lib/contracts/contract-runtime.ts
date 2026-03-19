import { API_CURRENT_VERSION, API_VERSION_HEADER, type ApiVersion } from "@contracts/http";
import { ZodError, type ZodTypeAny, z } from "zod";

export type ContractDirection = "request" | "response";
type VersionedContractSchemas = Partial<Record<ApiVersion, ZodTypeAny>>;

export const CONTRACT_DEGRADATION_EVENT_NAME = "contract:degraded";

export type ContractVersionDowngradeDetail = {
  context: string;
  direction: ContractDirection;
  expectedVersion: ApiVersion;
  parsedVersion: ApiVersion;
  reason: "missing_response_version_header" | "explicit_legacy_response_version";
};

function formatZodError(error: ZodError) {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return "Falha de validacao do contrato";
  }

  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}

export class ContractValidationError extends Error {
  readonly context: string;
  readonly direction: ContractDirection;
  readonly versionTried?: string;

  constructor(params: {
    context: string;
    direction: ContractDirection;
    message: string;
    versionTried?: string;
  }) {
    super(params.message);
    this.name = "ContractValidationError";
    this.context = params.context;
    this.direction = params.direction;
    this.versionTried = params.versionTried;
  }
}

export function isContractValidationError(
  error: unknown,
  direction?: ContractDirection,
): error is ContractValidationError {
  if (!(error instanceof ContractValidationError)) {
    return false;
  }

  return direction ? error.direction === direction : true;
}

export function parseContractValue<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  context: string,
  direction: ContractDirection,
): z.infer<TSchema> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ContractValidationError({
        context,
        direction,
        message: `Contrato invalido de ${direction} em ${context}: ${formatZodError(error)}`,
      });
    }

    throw error;
  }
}

export function resolveApiVersionFromHeaders(headers: unknown): ApiVersion | null {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  const record = headers as Record<string, unknown>;
  const value =
    record[API_VERSION_HEADER] ||
    record[API_VERSION_HEADER.toLowerCase()] ||
    record[API_VERSION_HEADER.toUpperCase()];

  if (value === "1" || value === "2") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] === "1" || value[0] === "2" ? value[0] : null;
  }

  return null;
}

export function parseVersionedContractValue<TSchema extends ZodTypeAny>(
  schemasByVersion: VersionedContractSchemas,
  value: unknown,
  context: string,
  direction: ContractDirection,
  preferredVersion?: ApiVersion | null,
  options: {
    allowVersionFallback?: boolean;
    expectedVersion?: ApiVersion;
    onVersionDowngrade?: (detail: ContractVersionDowngradeDetail) => void;
  } = {},
) {
  const expectedVersion = options.expectedVersion || API_CURRENT_VERSION;
  const negotiatedVersion = preferredVersion || expectedVersion;
  const primarySchema = schemasByVersion[negotiatedVersion];

  if (primarySchema) {
    try {
      const parsed = primarySchema.parse(value) as z.infer<TSchema>;

      if (preferredVersion && preferredVersion !== expectedVersion) {
        const detail: ContractVersionDowngradeDetail = {
          context,
          direction,
          expectedVersion,
          parsedVersion: preferredVersion,
          reason: "explicit_legacy_response_version",
        };

        reportContractVersionDowngrade(detail);
        options.onVersionDowngrade?.(detail);
      }

      return parsed;
    } catch (error) {
      if (!(error instanceof ZodError)) {
        throw error;
      }

      if (!options.allowVersionFallback || preferredVersion) {
        throw new ContractValidationError({
          context,
          direction,
          message: `Contrato invalido de ${direction} em ${context}: ${formatZodError(error)}`,
          versionTried: negotiatedVersion,
        });
      }
    }
  }

  if (!options.allowVersionFallback || preferredVersion) {
    throw new ContractValidationError({
      context,
      direction,
      message: `Contrato invalido de ${direction} em ${context}: schema ausente para a versao ${negotiatedVersion}`,
      versionTried: negotiatedVersion,
    });
  }

  let lastZodError: ZodError | null = null;

  for (const version of buildFallbackVersionCandidates(expectedVersion, schemasByVersion)) {
    const schema = schemasByVersion[version];
    if (!schema) {
      continue;
    }

    try {
      const parsed = schema.parse(value) as z.infer<TSchema>;
      const detail: ContractVersionDowngradeDetail = {
        context,
        direction,
        expectedVersion,
        parsedVersion: version,
        reason: "missing_response_version_header",
      };

      reportContractVersionDowngrade(detail);
      options.onVersionDowngrade?.(detail);
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        lastZodError = error;
        continue;
      }

      throw error;
    }
  }

  throw new ContractValidationError({
    context,
    direction,
    message: `Contrato invalido de ${direction} em ${context}: ${formatZodError(
      lastZodError || new ZodError([]),
    )}`,
    versionTried: [expectedVersion, ...buildFallbackVersionCandidates(expectedVersion, schemasByVersion)].join(","),
  });
}

export async function executeContractRequestWithRetry<T>(
  request: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown, attemptNumber: number) => boolean;
  } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts || 1);
  const baseDelayMs = Math.max(0, options.baseDelayMs || 250);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs || 2_000);

  let lastError: unknown;

  for (let attemptNumber = 1; attemptNumber <= attempts; attemptNumber += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      const canRetry =
        attemptNumber < attempts &&
        (options.shouldRetry ? options.shouldRetry(error, attemptNumber) : false);

      if (!canRetry) {
        throw error;
      }

      const delayMs = Math.min(baseDelayMs * 2 ** (attemptNumber - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function isTransientRequestError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const row = error as {
    code?: string;
    message?: string;
    response?: {
      status?: number;
    };
  };

  if (isContractValidationError(error)) {
    return false;
  }

  const code = String(row.code || "").trim().toUpperCase();
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ERR_NETWORK" ||
    code === "ECONNRESET"
  ) {
    return true;
  }

  const status = Number(row.response?.status);
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function buildFallbackVersionCandidates(
  expectedVersion: ApiVersion,
  schemasByVersion: VersionedContractSchemas,
): ApiVersion[] {
  const candidates: ApiVersion[] = [];

  for (const version of ["2", "1"] as ApiVersion[]) {
    if (version !== expectedVersion && schemasByVersion[version]) {
      candidates.push(version);
    }
  }

  return candidates;
}

function reportContractVersionDowngrade(detail: ContractVersionDowngradeDetail) {
  if (typeof console !== "undefined") {
    console.warn(
      `[contracts] downgrade controlado em ${detail.context}: esperado v${detail.expectedVersion}, interpretado como v${detail.parsedVersion}.`,
    );
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ContractVersionDowngradeDetail>(CONTRACT_DEGRADATION_EVENT_NAME, {
        detail,
      }),
    );
  }
}
