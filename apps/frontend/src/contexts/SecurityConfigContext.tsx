"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

interface SecurityConfig {
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  twoFactorRequiredForAdmins: boolean;
  twoFactorSuggested: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: PasswordPolicy;
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

  const fetchConfig = async () => {
    try {
      setLoading(true);

      // Busca configurações completas de segurança
      const response = await api.get("/security-config/full");

      // Mapeia os dados do backend para o formato esperado
      const backendConfig = response.data;
      setConfig({
        twoFactorEnabled: backendConfig.twoFactorEnabled || false,
        twoFactorRequired: backendConfig.twoFactorRequired || false,
        twoFactorRequiredForAdmins: backendConfig.twoFactorRequiredForAdmins || false,
        twoFactorSuggested: backendConfig.twoFactorSuggested || true,
        sessionTimeoutMinutes: backendConfig.sessionTimeoutMinutes || 30,
        passwordPolicy: {
          minLength: backendConfig.passwordMinLength || 8,
          requireUppercase: backendConfig.passwordRequireUppercase !== false,
          requireLowercase: backendConfig.passwordRequireLowercase !== false,
          requireNumbers: backendConfig.passwordRequireNumbers !== false,
          requireSpecial: backendConfig.passwordRequireSpecial !== false,
        }
      });
    } catch (error) {
      console.error("Erro ao carregar configurações de segurança:", error);

      // Em caso de erro, assume valores padrão
      setConfig({
        twoFactorEnabled: false,
        twoFactorRequired: false,
        twoFactorRequiredForAdmins: false,
        twoFactorSuggested: true,
        sessionTimeoutMinutes: 30,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecial: true,
        }
      });
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