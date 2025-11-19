"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface SecurityConfig {
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecial: boolean;
  };
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
    const cacheTTL = 10 * 60 * 1000; // 10 minutos (aumentado)

    // Verificar cache se não for forçado
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTTL) {
            console.log('🔧 Usando cache de configurações de segurança');
            setConfig(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }
    }

    try {
      setLoading(true);
      console.log('🔧 Buscando configurações de segurança da API');

      // Buscar configurações sequencialmente para reduzir carga
      const twoFactorResponse = await api.get("/security-config/2fa-status");
      const sessionResponse = await api.get("/security-config/session-timeout");
      const passwordResponse = await api.get("/security-config/password-policy");

      const newConfig = {
        twoFactorEnabled: twoFactorResponse.data.enabled,
        twoFactorRequired: twoFactorResponse.data.required,
        sessionTimeoutMinutes: sessionResponse.data.sessionTimeoutMinutes,
        passwordPolicy: passwordResponse.data,
      };

      setConfig(newConfig);

      // Cache o resultado
      localStorage.setItem(cacheKey, JSON.stringify({
        data: newConfig,
        timestamp: Date.now()
      }));
      console.log('💾 Configurações de segurança cacheadas');

    } catch (error) {
      console.error('❌ Erro ao buscar configurações de segurança:', error);
      // Em caso de erro, assume valores padrão
      const defaultConfig = {
        twoFactorEnabled: true,
        twoFactorRequired: false,
        sessionTimeoutMinutes: 30,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecial: true,
        },
      };
      setConfig(defaultConfig);

      // Cache mesmo em erro (por menos tempo)
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