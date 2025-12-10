"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | "CLIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  tenant?: {
    id: string;
    nomeFantasia: string;
    cnpjCpf: string;
    telefone: string;
  } | null;
  twoFactorEnabled?: boolean;
}

export interface LoginResult {
  success: boolean;
  requires2FA: boolean;
  user?: User;
  error?: string;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<LoginResult>;
  loginWith2FA: (email: string, password: string, code: string) => Promise<LoginResult>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

/**
 * SecureStorage - Gerenciamento de tokens
 * 
 * IMPORTANTE: localStorage não é completamente seguro contra XSS.
 * Em produção, considere usar cookies HttpOnly com SameSite=Strict
 * ou implementar criptografia real com Web Crypto API.
 * 
 * Removemos a falsa "criptografia" Base64 que apenas dava falsa sensação
 * de segurança. Os tokens agora são armazenados diretamente.
 */
const SecureStorage = {
  setToken: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("@App:token", token);
    }
  },

  getToken: (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("@App:token");
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("@App:token");
    }
  },

  setRefreshToken: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("@App:refreshToken", token);
    }
  },

  getRefreshToken: (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("@App:refreshToken");
    }
    return null;
  },

  removeRefreshToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("@App:refreshToken");
    }
  },

  /**
   * Limpa todos os tokens do armazenamento
   */
  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("@App:token");
      localStorage.removeItem("@App:refreshToken");
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const token = SecureStorage.getToken();

      if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        try {
          // Buscar dados atualizados do usuário
          const response = await api.get("/auth/me");
          setUser(response.data);
        } catch (error) {
          console.error("Erro ao carregar usuário:", error);
          SecureStorage.removeToken();
          delete api.defaults.headers.common["Authorization"];
        }
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken, user: userData } = response.data;

      SecureStorage.setToken(accessToken);
      SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      setUser(userData);
      router.push("/dashboard");
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Erro ao fazer login"
      );
    }
  }

  async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
    try {
      // Validar inputs
      if (!email || !password) {
        return {
          success: false,
          requires2FA: false,
          error: "Preencha todos os campos"
        };
      }

      // Tentar login normal
      const response = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken, user: userData } = response.data;

      // Salvar tokens no SecureStorage
      SecureStorage.setToken(accessToken);
      SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Atualizar estado do usuário
      setUser(userData);

      // Redirecionar para dashboard
      router.push("/dashboard");

      return {
        success: true,
        requires2FA: false,
        user: userData
      };
    } catch (error: any) {
      // Verificar se é erro de 2FA
      const errorMessage = error.response?.data?.message || "";
      if (errorMessage.includes("2FA") || errorMessage.includes("two-factor")) {
        return {
          success: false,
          requires2FA: true
        };
      }

      // Outros erros
      return {
        success: false,
        requires2FA: false,
        error: errorMessage || "Erro ao fazer login"
      };
    }
  }

  async function loginWith2FA(email: string, password: string, code: string): Promise<LoginResult> {
    try {
      // Validar inputs
      if (!email || !password || !code) {
        return {
          success: false,
          requires2FA: false,
          error: "Preencha todos os campos"
        };
      }

      // Login com 2FA
      const response = await api.post("/auth/login-2fa", {
        email,
        password,
        twoFactorToken: code
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      // Salvar tokens no SecureStorage
      SecureStorage.setToken(accessToken);
      SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Atualizar estado do usuário
      setUser(userData);

      // Redirecionar para dashboard
      router.push("/dashboard");

      return {
        success: true,
        requires2FA: false,
        user: userData
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Código inválido";
      return {
        success: false,
        requires2FA: false,
        error: errorMessage
      };
    }
  }

  async function logout() {
    const refreshToken = SecureStorage.getRefreshToken();

    // Invalidar refresh token no backend
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken });
      } catch (error) {
        console.error("Erro ao fazer logout no backend:", error);
      }
    }

    SecureStorage.removeToken();
    SecureStorage.removeRefreshToken();
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
    router.push("/login");
  }

  function updateUser(userData: Partial<User>) {
    if (user) {
      setUser({ ...user, ...userData });
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithCredentials, loginWith2FA, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
