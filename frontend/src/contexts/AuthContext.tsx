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
  } | null;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Simulação de armazenamento seguro (Electron Keytar/Keychain)
const SecureStorage = {
  setToken: (token: string) => {
    // Em produção Electron, usar: keytar.setPassword('app', 'jwt', token)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("@App:token", token);
    }
  },
  getToken: (): string | null => {
    // Em produção Electron, usar: keytar.getPassword('app', 'jwt')
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("@App:token");
    }
    return null;
  },
  removeToken: () => {
    // Em produção Electron, usar: keytar.deletePassword('app', 'jwt')
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("@App:token");
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = SecureStorage.getToken();

    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Aqui você poderia fazer uma requisição para validar o token
      // Por simplicidade, vamos decodificar o payload do JWT
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        // Simula buscar dados do usuário
        setUser({
          id: payload.sub,
          email: payload.email,
          name: payload.email.split("@")[0],
          role: payload.role,
          tenantId: payload.tenantId,
        });
      } catch (error) {
        SecureStorage.removeToken();
      }
    }

    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { accessToken, user: userData } = response.data;

      SecureStorage.setToken(accessToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      setUser(userData);
      router.push("/dashboard");
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Erro ao fazer login"
      );
    }
  }

  function logout() {
    SecureStorage.removeToken();
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
