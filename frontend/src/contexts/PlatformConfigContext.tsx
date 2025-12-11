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
      
      const response = await api.get('/platform-config');
      setConfig(response.data);
    } catch (err: any) {
      console.warn('Failed to fetch platform config:', err);
      setError(err.message || 'Failed to load platform configuration');
      setConfig(DEFAULT_PLATFORM_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const refreshConfig = async () => {
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