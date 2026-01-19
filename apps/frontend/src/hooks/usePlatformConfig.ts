import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface PlatformConfig {
  platformName: string;
  platformEmail: string;
  platformPhone: string;
}

// Default values as constants
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  platformName: 'Sistema Multitenant',
  platformEmail: 'contato@sistema.com',
  platformPhone: '(11) 99999-9999',
};

// Global cache for platform config
let globalPlatformConfig: PlatformConfig | null = null;
let configPromise: Promise<PlatformConfig> | null = null;

/**
 * Fetch platform configuration from API
 */
async function fetchPlatformConfig(): Promise<PlatformConfig> {
  try {
    const response = await api.get('/platform-config');
    globalPlatformConfig = response.data;
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch platform config, using defaults:', error);
    globalPlatformConfig = DEFAULT_PLATFORM_CONFIG;
    return DEFAULT_PLATFORM_CONFIG;
  }
}

/**
 * Get platform configuration (cached)
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (globalPlatformConfig) {
    return globalPlatformConfig;
  }

  if (!configPromise) {
    configPromise = fetchPlatformConfig();
  }

  return configPromise;
}

/**
 * Get platform name only
 */
export async function getPlatformName(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformName;
}

/**
 * Get platform email only
 */
export async function getPlatformEmail(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformEmail;
}

/**
 * Get platform phone only
 */
export async function getPlatformPhone(): Promise<string> {
  const config = await getPlatformConfig();
  return config.platformPhone;
}

/**
 * Clear platform config cache
 */
export function clearPlatformConfigCache(): void {
  globalPlatformConfig = null;
  configPromise = null;
}

/**
 * React hook for platform configuration
 */
export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const platformConfig = await getPlatformConfig();

        if (mounted) {
          setConfig(platformConfig);
        }
      } catch (err: unknown) {
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load platform configuration';
          setError(errorMsg);
          setConfig(DEFAULT_PLATFORM_CONFIG);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      mounted = false;
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
      const errorMsg = err instanceof Error ? err.message : 'Failed to refresh platform configuration';
      setError(errorMsg);
      setConfig(DEFAULT_PLATFORM_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  return {
    config,
    loading,
    error,
    refreshConfig,
    // Individual getters for convenience
    platformName: config.platformName,
    platformEmail: config.platformEmail,
    platformPhone: config.platformPhone,
  };
}

/**
 * React hook for platform name only
 */
export function usePlatformName() {
  const { platformName, loading, error } = usePlatformConfig();
  return { platformName, loading, error };
}

/**
 * React hook for platform email only
 */
export function usePlatformEmail() {
  const { platformEmail, loading, error } = usePlatformConfig();
  return { platformEmail, loading, error };
}

/**
 * React hook for platform phone only
 */
export function usePlatformPhone() {
  const { platformPhone, loading, error } = usePlatformConfig();
  return { platformPhone, loading, error };
}