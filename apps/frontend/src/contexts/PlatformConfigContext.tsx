"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearPlatformConfigCache,
  DEFAULT_PLATFORM_CONFIG,
  getPlatformConfig,
  type PlatformConfig,
} from "@/hooks/usePlatformConfig";

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
  if (!context) {
    throw new Error("usePlatformConfigContext must be used within a PlatformConfigProvider");
  }

  return context;
}
