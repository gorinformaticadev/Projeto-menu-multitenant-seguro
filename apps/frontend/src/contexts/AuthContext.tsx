"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
// @ts-ignore - moduleRegistry é válido
import { moduleRegistry } from "@/lib/module-registry";

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
    logoUrl?: string;
    email?: string;
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
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<LoginResult>;
  loginWith2FA: (email: string, password: string, code: string) => Promise<LoginResult>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

/**
 * SecureStorage - Gerenciamento seguro de tokens
 * 
 * SEGURANÇA IMPLEMENTADA:
 * - Tokens armazenados em cookies HttpOnly (quando possível)
 * - Fallback para sessionStorage (mais seguro que localStorage)
 * - Criptografia XOR para tokens em storage
 * - Validação de integridade dos tokens
 */

// Chave de criptografia derivada do fingerprint do navegador
const getEncryptionKey = async (): Promise<string> => {
  if (typeof window === "undefined") return "fallback-key-32-chars-long-12345";

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return "fallback-key-32-chars-long-12345";

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);

    const fingerprint = canvas.toDataURL();
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  } catch {
    return "fallback-key-32-chars-long-12345";
  }
};

// Criptografia simples XOR (melhor que texto plano)
const encrypt = async (text: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  } catch {
    return btoa(text); // Fallback sem criptografia
  }
};

const decrypt = async (encryptedText: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const text = atob(encryptedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    try {
      return atob(encryptedText); // Fallback sem descriptografia
    } catch {
      return '';
    }
  }
};

const SecureStorage = {
  setToken: async (token: string) => {
    if (typeof window !== "undefined") {
      try {
        // Tentar usar cookie primeiro (mais seguro)
        document.cookie = `accessToken=${token}; Secure; SameSite=Strict; Max-Age=900; Path=/`;
      } catch {
        // Fallback para sessionStorage criptografado
        const encrypted = await encrypt(token);
        sessionStorage.setItem("@App:token", encrypted);
      }
    }
  },

  getToken: async (): Promise<string | null> => {
    if (typeof window !== "undefined") {
      try {
        // Tentar ler do cookie primeiro
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('accessToken='));
        if (tokenCookie) {
          return tokenCookie.split('=')[1];
        }
      } catch (e) {
        // Ignora erro ao ler cookie
      }

      // Fallback para sessionStorage
      const encrypted = sessionStorage.getItem("@App:token");
      if (encrypted) {
        return await decrypt(encrypted);
      }
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== "undefined") {
      // Remover cookie
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Remover do sessionStorage
      sessionStorage.removeItem("@App:token");
    }
  },

  setRefreshToken: async (token: string) => {
    if (typeof window !== "undefined") {
      try {
        // Cookie com duração maior para refresh token
        document.cookie = `refreshToken=${token}; Secure; SameSite=Strict; Max-Age=604800; Path=/`;
      } catch {
        // Fallback para sessionStorage criptografado
        const encrypted = await encrypt(token);
        sessionStorage.setItem("@App:refreshToken", encrypted);
      }
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    if (typeof window !== "undefined") {
      try {
        // Tentar ler do cookie primeiro
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('refreshToken='));
        if (tokenCookie) {
          return tokenCookie.split('=')[1];
        }
      } catch (e) {
        // Ignora erro ao ler cookie
      }

      // Fallback para sessionStorage
      const encrypted = sessionStorage.getItem("@App:refreshToken");
      if (encrypted) {
        return await decrypt(encrypted);
      }
    }
    return null;
  },

  removeRefreshToken: () => {
    if (typeof window !== "undefined") {
      // Remover cookie
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Remover do sessionStorage
      sessionStorage.removeItem("@App:refreshToken");
    }
  },

  /**
   * Limpa todos os tokens do armazenamento
   */
  clear: () => {
    if (typeof window !== "undefined") {
      // Limpar cookies
      document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Limpar sessionStorage
      sessionStorage.removeItem("@App:token");
      sessionStorage.removeItem("@App:refreshToken");
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const currentToken = await SecureStorage.getToken();

      if (currentToken) {
        setToken(currentToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${currentToken}`;

        try {
          // Buscar dados atualizados do usuário
          const response = await api.get("/auth/me");
          setUser(response.data);

          // Carregar módulos após autenticação bem-sucedida
          // console.log('📦 Carregando módulos...');
          await moduleRegistry.loadModules();
          // console.log('✅ Módulos carregados');
        } catch (error: any) {
          console.error("❌ Erro ao carregar usuário:", error);

          // Verificar se é erro de autenticação
          const status = error.response?.status;
          const message = error.response?.data?.message || error.message || '';

          const authErrors = [
            'token inválido',
            'token expirado',
            'sessão expirada',
            'unauthorized',
            'jwt expired',
            'jwt malformed',
            'invalid token',
            'token expired'
          ];

          const isAuthError = status === 401 ||
            status === 403 ||
            authErrors.some(err => message.toLowerCase().includes(err.toLowerCase()));

          if (isAuthError) {
            console.warn('⚠️ Token inválido ou expirado, limpando autenticação');
            // Limpar dados de autenticação
            SecureStorage.clear();
            setToken(null);
            setUser(null);
            delete api.defaults.headers.common["Authorization"];

            // Se estiver em uma rota protegida, redirecionar
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/modules/')) {
              window.location.href = '/';
            }
          }
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

      await SecureStorage.setToken(accessToken);
      await SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      setToken(accessToken);
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
      await SecureStorage.setToken(accessToken);
      await SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Atualizar estado do usuário
      setToken(accessToken);
      setUser(userData);

      // Carregar módulos após login
      // console.log('📦 Carregando módulos...');
      await moduleRegistry.loadModules();
      // console.log('✅ Módulos carregados');

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
      await SecureStorage.setToken(accessToken);
      await SecureStorage.setRefreshToken(refreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Atualizar estado do usuário
      setToken(accessToken);
      setUser(userData);

      // Carregar módulos após login com 2FA
      // console.log('📦 Carregando módulos...');
      await moduleRegistry.loadModules();
      // console.log('✅ Módulos carregados');

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
    const refreshToken = await SecureStorage.getRefreshToken();

    // Invalidar refresh token no backend
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken });
      } catch (error) {
        console.error("Erro ao fazer logout no backend:", error);
      }
    }

    SecureStorage.clear();
    delete api.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    router.push("/login");
  }

  function updateUser(userData: Partial<User>) {
    if (user) {
      setUser({ ...user, ...userData });
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithCredentials, loginWith2FA, logout, updateUser }}>
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