"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface SecurityConfig {
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

interface SecurityConfigContextType {
  config: SecurityConfig | null;
  loading: boolean;
}

const SecurityConfigContext = createContext<SecurityConfigContextType | undefined>(undefined);

export function SecurityConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await api.get("/security-config/2fa-status");
        setConfig(response.data);
      } catch (error) {
        // Em caso de erro, assume valores padrão
        setConfig({
          twoFactorEnabled: true,
          twoFactorRequired: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <SecurityConfigContext.Provider value={{ config, loading }}>
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