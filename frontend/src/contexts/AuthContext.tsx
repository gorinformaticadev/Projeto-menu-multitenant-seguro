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

interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Armazenamento seguro com localStorage (persistente) e criptografia básica
const SecureStorage = {
  // Chave de criptografia simples (em produção, usar crypto mais robusto)
  encryptionKey: 'app-secure-key-2024',

  encrypt: (text: string): string => {
    // Criptografia básica para evitar exposição óbvia
    return btoa(text); // Base64 encoding
  },

  decrypt: (encrypted: string): string => {
    try {
      return atob(encrypted);
    } catch {
      return '';
    }
  },

  setToken: (token: string) => {
    if (typeof window !== "undefined") {
      const encrypted = SecureStorage.encrypt(token);
      localStorage.setItem("@App:token", encrypted);
    }
  },

  getToken: (): string | null => {
    if (typeof window !== "undefined") {
      const encrypted = localStorage.getItem("@App:token");
      return encrypted ? SecureStorage.decrypt(encrypted) : null;
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
      const encrypted = SecureStorage.encrypt(token);
      localStorage.setItem("@App:refreshToken", encrypted);
    }
  },

  getRefreshToken: (): string | null => {
    if (typeof window !== "undefined") {
      const encrypted = localStorage.getItem("@App:refreshToken");
      return encrypted ? SecureStorage.decrypt(encrypted) : null;
    }
    return null;
  },

  removeRefreshToken: () => {
    if (typeof window !== "undefined") {
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
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
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
