import { useEffect, useState } from "react";
import api from "@/lib/api";

const PLATFORM_CONFIG_CACHE_KEY = "platform-config-cache";
const PLATFORM_CONFIG_CACHE_TTL_MS = 60 * 1000;

export interface PlatformConfig {
  platformName: string;
  platformLogoUrl: string | null;
  masterLogoUrl: string | null;
  platformBrandLogoUrl: string | null;
  platformEmail: string;
  platformPhone: string;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  platformName: "Pluggor",
  platformLogoUrl: null,
  masterLogoUrl: null,
  platformBrandLogoUrl: null,
  platformEmail: "contato@pluggor.com.br",
  platformPhone: "(11) 99999-9999",
};

let globalPlatformConfig: PlatformConfig | null = null;
let configPromise: Promise<PlatformConfig> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizePlatformConfig(
  responseData: unknown,
  masterLogoUrl: string | null,
): PlatformConfig {
  const data = isRecord(responseData) ? responseData : {};
  const platformLogoUrl = normalizeOptionalString(data.platformLogoUrl);
  const normalizedMasterLogoUrl = normalizeOptionalString(masterLogoUrl);

  return {
    platformName:
      typeof data.platformName === "string" && data.platformName.trim()
        ? data.platformName
        : DEFAULT_PLATFORM_CONFIG.platformName,
    platformLogoUrl,
    masterLogoUrl: normalizedMasterLogoUrl,
    platformBrandLogoUrl: platformLogoUrl ?? normalizedMasterLogoUrl,
    platformEmail:
      typeof data.platformEmail === "string" && data.platformEmail.trim()
        ? data.platformEmail
        : DEFAULT_PLATFORM_CONFIG.platformEmail,
    platformPhone:
      typeof data.platformPhone === "string" && data.platformPhone.trim()
        ? data.platformPhone
        : DEFAULT_PLATFORM_CONFIG.platformPhone,
  };
}

function readPlatformConfigCache(): PlatformConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cachedValue = window.localStorage.getItem(PLATFORM_CONFIG_CACHE_KEY);
  if (!cachedValue) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(cachedValue) as {
      data?: unknown;
      timestamp?: unknown;
    };

    if (
      typeof parsedCache.timestamp !== "number" ||
      Date.now() - parsedCache.timestamp >= PLATFORM_CONFIG_CACHE_TTL_MS
    ) {
      window.localStorage.removeItem(PLATFORM_CONFIG_CACHE_KEY);
      return null;
    }

    return normalizePlatformConfig(
      parsedCache.data,
      isRecord(parsedCache.data) ? normalizeOptionalString(parsedCache.data.masterLogoUrl) : null,
    );
  } catch {
    window.localStorage.removeItem(PLATFORM_CONFIG_CACHE_KEY);
    return null;
  }
}

function writePlatformConfigCache(config: PlatformConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PLATFORM_CONFIG_CACHE_KEY,
    JSON.stringify({
      data: config,
      timestamp: Date.now(),
    }),
  );
}

async function fetchMasterLogo(): Promise<string | null> {
  try {
    const response = await api.get("/api/tenants/public/master-logo");
    return normalizeOptionalString(response.data?.logoUrl);
  } catch {
    return null;
  }
}

async function fetchPlatformConfig(): Promise<PlatformConfig> {
  const cachedConfig = readPlatformConfigCache();
  if (cachedConfig) {
    globalPlatformConfig = cachedConfig;
    return cachedConfig;
  }

  try {
    const [platformConfigResult, masterLogoUrl] = await Promise.all([
      api.get("/api/platform-config"),
      fetchMasterLogo(),
    ]);

    const normalizedConfig = normalizePlatformConfig(platformConfigResult.data, masterLogoUrl);
    globalPlatformConfig = normalizedConfig;
    writePlatformConfigCache(normalizedConfig);
    return normalizedConfig;
  } catch (error) {
    console.warn("Failed to fetch platform config, using defaults:", error);
    const fallbackConfig = normalizePlatformConfig({}, null);
    globalPlatformConfig = fallbackConfig;
    return fallbackConfig;
  }
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (globalPlatformConfig) {
    return globalPlatformConfig;
  }

  if (!configPromise) {
    configPromise = fetchPlatformConfig().finally(() => {
      configPromise = null;
    });
  }

  return configPromise;
}

export async function getPlatformName(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformName;
}

export async function getPlatformEmail(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformEmail;
}

export async function getPlatformPhone(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformPhone;
}

export function clearPlatformConfigCache(): void {
  globalPlatformConfig = null;
  configPromise = null;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PLATFORM_CONFIG_CACHE_KEY);
  }
}

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const platformConfig = await getPlatformConfig();
        if (isMounted) {
          setConfig(platformConfig);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setConfig(DEFAULT_PLATFORM_CONFIG);
          setError(
            err instanceof Error ? err.message : "Failed to load platform configuration",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshConfig = async () => {
    clearPlatformConfigCache();
    setLoading(true);

    try {
      const platformConfig = await getPlatformConfig();
      setConfig(platformConfig);
      setError(null);
    } catch (err: unknown) {
      setConfig(DEFAULT_PLATFORM_CONFIG);
      setError(err instanceof Error ? err.message : "Failed to refresh platform configuration");
    } finally {
      setLoading(false);
    }
  };

  return {
    config,
    loading,
    error,
    refreshConfig,
    platformName: config.platformName,
    platformEmail: config.platformEmail,
    platformPhone: config.platformPhone,
    platformLogoUrl: config.platformLogoUrl,
    platformBrandLogoUrl: config.platformBrandLogoUrl,
  };
}

export function usePlatformName() {
  const { platformName, loading, error } = usePlatformConfig();
  return { platformName, loading, error };
}

export function usePlatformEmail() {
  const { platformEmail, loading, error } = usePlatformConfig();
  return { platformEmail, loading, error };
}

export function usePlatformPhone() {
  const { platformPhone, loading, error } = usePlatformConfig();
  return { platformPhone, loading, error };
}
