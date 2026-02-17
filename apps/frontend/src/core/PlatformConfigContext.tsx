"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PlatformConfig, DEFAULT_PLATFORM_CONFIG } from '@/hooks/usePlatformConfig';
import api from '@/lib/api';

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

      // Cache simples para evitar múltiplas chamadas
      const cacheKey = 'platform-config-cache';
      const cacheTTL = 5 * 60 * 1000; // 5 minutos
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTTL) {
          setConfig(data);
          setLoading(false);
          return;
        }
      }

      const response = await api.get('/api/platform-config');
      setConfig(response.data);

      // Salvar no cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));

    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.warn('Failed to fetch platform config:', err);
      setError(errorObj.message || 'Failed to load platform configuration');
      setConfig(DEFAULT_PLATFORM_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce para evitar múltiplas chamadas em React StrictMode
    const timeoutId = setTimeout(() => {
      fetchConfig();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  const refreshConfig = async () => {
    // Invalidar cache antes de buscar novos dados
    localStorage.removeItem('platform-config-cache');
    await fetchConfig();
  };

  // Update document title when config changes
  useEffect(() => {
    if (!loading && config.platformName) {
      document.title = config.platformName;
    }
  }, [config.platformName, loading]);

  return (
    <PlatformConfigContext.Provider value={{
      config,
      loading,
      error,
      refreshConfig
    }}>
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfigContext() {
  const context = useContext(PlatformConfigContext);
  if (context === undefined) {
    throw new Error('usePlatformConfigContext must be used within a PlatformConfigProvider');
  }
  return context;
}
