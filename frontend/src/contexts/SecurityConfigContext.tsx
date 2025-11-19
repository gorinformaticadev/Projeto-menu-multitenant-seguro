"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface SecurityConfig {
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  sessionTimeoutMinutes: number;
}

interface SecurityConfigContextType {
  config: SecurityConfig | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const SecurityConfigContext = createContext<SecurityConfigContextType | undefined>(undefined);

export function SecurityConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async (force = false) => {
    const cacheKey = 'security-config-cache';
    const cacheTTL = 5 * 60 * 1000; // 5 minutos

    // Verificar cache se não for forçado
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTTL) {
            setConfig(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Cache inválido, continua
        }
      }
    }

    try {
      setLoading(true);

      // Buscar configurações de 2FA e session timeout
      const [twoFactorResponse, sessionResponse] = await Promise.all([
        api.get("/security-config/2fa-status"),
        api.get("/security-config/session-timeout")
      ]);

      const newConfig = {
        twoFactorEnabled: twoFactorResponse.data.enabled,
        twoFactorRequired: twoFactorResponse.data.required,
        sessionTimeoutMinutes: sessionResponse.data.sessionTimeoutMinutes,
      };

      setConfig(newConfig);

      // Cache o resultado
      localStorage.setItem(cacheKey, JSON.stringify({
        data: newConfig,
        timestamp: Date.now()
      }));

    } catch (error) {
      // Em caso de erro, assume valores padrão
      const defaultConfig = {
        twoFactorEnabled: true,
        twoFactorRequired: false,
        sessionTimeoutMinutes: 30,
      };
      setConfig(defaultConfig);

      // Cache mesmo em erro
      localStorage.setItem(cacheKey, JSON.stringify({
        data: defaultConfig,
        timestamp: Date.now()
      }));
    } finally {
      setLoading(false);
    }
  };

  const refreshConfig = async () => {
    await fetchConfig(true); // Forçar refresh
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <SecurityConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SecurityConfigContext.Provider>
  );
}

export function useSecurityConfig() {
  const context = useContext(SecurityConfigContext);
  if (context === undefined) {
    throw new Error("useSecurityConfig must be used within a SecurityConfigProvider");
  }
  return context;
}