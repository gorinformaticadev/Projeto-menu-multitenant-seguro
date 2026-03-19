"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PlatformConfig, DEFAULT_PLATFORM_CONFIG } from "@/hooks/usePlatformConfig";
import api from "@/lib/api";

interface PlatformConfigContextType {
  config: PlatformConfig;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

const PlatformConfigContext = createContext<PlatformConfigContextType | undefined>(undefined);

export function PlatformConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = "platform-config-cache";
      const cacheTTL = 60 * 1000;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTTL) {
          setConfig({
            platformName: String(data?.platformName || DEFAULT_PLATFORM_CONFIG.platformName),
            platformLogoUrl:
              typeof data?.platformLogoUrl === "string" && data.platformLogoUrl.trim()
                ? data.platformLogoUrl
                : null,
            platformEmail: String(data?.platformEmail || DEFAULT_PLATFORM_CONFIG.platformEmail),
            platformPhone: String(data?.platformPhone || DEFAULT_PLATFORM_CONFIG.platformPhone),
          });
          setLoading(false);
          return;
        }
      }

      const response = await api.get("/api/platform-config");
      const responseData = response.data || {};
      const normalizedConfig: PlatformConfig = {
        platformName: String(responseData.platformName || DEFAULT_PLATFORM_CONFIG.platformName),
        platformLogoUrl:
          typeof responseData.platformLogoUrl === "string" && responseData.platformLogoUrl.trim()
            ? responseData.platformLogoUrl
            : null,
        platformEmail: String(responseData.platformEmail || DEFAULT_PLATFORM_CONFIG.platformEmail),
        platformPhone: String(responseData.platformPhone || DEFAULT_PLATFORM_CONFIG.platformPhone),
      };

      setConfig(normalizedConfig);
      localStorage.setItem(cacheKey, JSON.stringify({
        data: normalizedConfig,
        timestamp: Date.now(),
      }));
    } catch (err: unknown) {
      console.warn("Failed to fetch platform config:", err);
      let errorMessage = "Failed to load platform configuration";
      if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
      ) {
        errorMessage = (err as { message: string }).message;
      }
      setError(errorMessage);
      setConfig(DEFAULT_PLATFORM_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchConfig();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  const refreshConfig = async () => {
    localStorage.removeItem("platform-config-cache");
    await fetchConfig();
  };

  useEffect(() => {
    if (!loading && config.platformName) {
      document.title = config.platformName;
    }
  }, [config.platformName, loading]);

  return (
    <PlatformConfigContext.Provider value={{ config, loading, error, refreshConfig }}>
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfigContext() {
  const context = useContext(PlatformConfigContext);
  if (context === undefined) {
    throw new Error("usePlatformConfigContext must be used within a PlatformConfigProvider");
  }
  return context;
}
