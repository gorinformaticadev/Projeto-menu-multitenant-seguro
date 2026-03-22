"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { type AppThemePreference, normalizeAppThemePreference } from "@/lib/app-theme";
import { moduleRegistry } from "@/lib/module-registry";
import { isProtectedRoute, isAuthRoute, isSafeCallbackUrl, ROUTE_CONFIG } from "@/lib/routes";

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | "CLIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  avatarUrl?: string | null;
  tenant?: {
    id: string;
    nomeFantasia: string;
    cnpjCpf: string;
    telefone: string;
    logoUrl?: string;
    email?: string;
  } | null;
  twoFactorEnabled?: boolean;
  preferences?: {
    theme?: AppThemePreference;
  } | null;
}

export interface LoginResult {
  success: boolean;
  requires2FA: boolean;
  mustEnrollTwoFactor: boolean;
  user?: User;
  error?: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
      code?: string;
      status?: string;
      invalidCredentials?: boolean;
    };
    status?: number;
  };
  message?: string;
  code?: string;
}

type AuthenticatedResponsePayload = {
  status: "AUTHENTICATED";
  authenticated: true;
  requiresTwoFactor: false;
  mustEnrollTwoFactor: false;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  user: User;
};

type RequiresTwoFactorPayload = {
  status: "REQUIRES_TWO_FACTOR";
  authenticated: false;
  requiresTwoFactor: true;
  mustEnrollTwoFactor: false;
};

type MustEnrollTwoFactorPayload = {
  status: "MUST_ENROLL_TWO_FACTOR";
  authenticated: false;
  requiresTwoFactor: false;
  mustEnrollTwoFactor: true;
  enrollmentExpiresAt?: string;
};

type LoginFlowPayload =
  | AuthenticatedResponsePayload
  | RequiresTwoFactorPayload
  | MustEnrollTwoFactorPayload;

const AUTH_REQUEST_TIMEOUT_MS = 15000;
const MODULE_LOAD_TIMEOUT_MS = 10000;
const SESSION_MARKER = "cookie-session";

const resolveApiErrorMessage = (error: ApiError, fallback: string): string => {
  if (error.code === "ECONNABORTED") {
    return "Tempo de resposta esgotado. Tente novamente.";
  }

  const apiMessage = error.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim()) {
    return apiMessage;
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const loadModulesSafely = async (): Promise<void> => {
  try {
    await Promise.race([
      moduleRegistry.loadModules(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("module_load_timeout")), MODULE_LOAD_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("Falha ao carregar modulos apos autenticacao:", error);
  }
};

const normalizeUserThemePreference = (nextUser: User): User => ({
  ...nextUser,
  preferences: nextUser.preferences
    ? {
        ...nextUser.preferences,
        theme: normalizeAppThemePreference(nextUser.preferences.theme),
      }
    : nextUser.preferences,
});

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<LoginResult>;
  loginWith2FA: (
    email: string,
    password: string,
    code: string,
    trustDevice: boolean,
  ) => Promise<LoginResult>;
  completeTwoFactorEnrollment: (
    code: string,
    trustDevice: boolean,
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  saveThemePreference: (theme: AppThemePreference) => Promise<AppThemePreference>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const withThemePreference = (nextUser: User, theme: AppThemePreference): User => ({
  ...nextUser,
  preferences: {
    ...(nextUser.preferences ?? {}),
    theme: normalizeAppThemePreference(theme),
  },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearAuthState = (shouldRedirect = false) => {
    setUser(null);
    setToken(null);

    if (typeof window !== "undefined") {
      document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }

    if (
      shouldRedirect &&
      typeof window !== "undefined" &&
      isProtectedRoute(window.location.pathname)
    ) {
      router.replace(
        `${ROUTE_CONFIG.unauthenticatedFallback}?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
    }
  };


  const handleAuthenticatedResponse = async (payload: AuthenticatedResponsePayload) => {
    setUser(normalizeUserThemePreference(payload.user));
    setToken(SESSION_MARKER);

    void loadModulesSafely();

    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const rawCallback = searchParams.get("callbackUrl");
    const callbackUrl = isSafeCallbackUrl(rawCallback)
      ? rawCallback!
      : ROUTE_CONFIG.authenticatedFallback;

    router.replace(callbackUrl);
  };

  useEffect(() => {
    const loadUser = async () => {
      if (typeof window !== "undefined" && isAuthRoute(window.location.pathname)) {
        setLoading(false);
        return;
      }

      try {

        const response = await api.get<User>("/auth/me", {
          timeout: AUTH_REQUEST_TIMEOUT_MS,
        });

        setUser(normalizeUserThemePreference(response.data));
        setToken(SESSION_MARKER);
        void loadModulesSafely();
      } catch (error: unknown) {
        const apiError = error as ApiError;
        const status = apiError.response?.status;

        if (status === 401 || status === 403) {
          clearAuthState(true);
        } else {
          console.error("Erro ao carregar usuario autenticado:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadUser();

    const handleForcedLogout = () => {
      clearAuthState(true);
    };

    window.addEventListener("auth:logout", handleForcedLogout);
    return () => {
      window.removeEventListener("auth:logout", handleForcedLogout);
    };
  }, []);

  async function login(email: string, password: string) {
    const result = await loginWithCredentials(email, password);

    if (!result.success) {
      throw new Error(result.error || "Erro ao fazer login");
    }
  }

  async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
    try {
      if (!email || !password) {
        return {
          success: false,
          requires2FA: false,
          mustEnrollTwoFactor: false,
          error: "Preencha todos os campos",
        };
      }

      const response = await api.post<LoginFlowPayload>(
        "/auth/login",
        { email, password },
        { timeout: AUTH_REQUEST_TIMEOUT_MS },
      );

      const payload = response.data;

      if (payload.status === "REQUIRES_TWO_FACTOR") {
        return {
          success: false,
          requires2FA: true,
          mustEnrollTwoFactor: false,
        };
      }

      if (payload.status === "MUST_ENROLL_TWO_FACTOR") {
        return {
          success: false,
          requires2FA: false,
          mustEnrollTwoFactor: true,
        };
      }

      await handleAuthenticatedResponse(payload);

      return {
        success: true,
        requires2FA: false,
        mustEnrollTwoFactor: false,
        user: payload.user,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      return {
        success: false,
        requires2FA: false,
        mustEnrollTwoFactor: false,
        error: resolveApiErrorMessage(apiError, "Erro ao fazer login"),
      };
    }
  }

  async function loginWith2FA(
    email: string,
    password: string,
    code: string,
    trustDevice: boolean,
  ): Promise<LoginResult> {
    try {
      if (!email || !password || !code) {
        return {
          success: false,
          requires2FA: false,
          mustEnrollTwoFactor: false,
          error: "Preencha todos os campos",
        };
      }

      const response = await api.post<AuthenticatedResponsePayload>(
        "/auth/login-2fa",
        {
          email,
          password,
          twoFactorToken: code,
          trustDevice,
        },
        { timeout: AUTH_REQUEST_TIMEOUT_MS },
      );

      await handleAuthenticatedResponse(response.data);

      return {
        success: true,
        requires2FA: false,
        mustEnrollTwoFactor: false,
        user: response.data.user,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      return {
        success: false,
        requires2FA: false,
        mustEnrollTwoFactor: false,
        error: resolveApiErrorMessage(apiError, "Codigo invalido"),
      };
    }
  }

  async function completeTwoFactorEnrollment(
    code: string,
    trustDevice: boolean,
  ): Promise<LoginResult> {
    try {
      if (!code) {
        return {
          success: false,
          requires2FA: false,
          mustEnrollTwoFactor: true,
          error: "Codigo obrigatorio",
        };
      }

      const response = await api.post<AuthenticatedResponsePayload>(
        "/auth/2fa/enrollment/enable",
        {
          token: code,
          trustDevice,
        },
        { timeout: AUTH_REQUEST_TIMEOUT_MS },
      );

      await handleAuthenticatedResponse(response.data);

      return {
        success: true,
        requires2FA: false,
        mustEnrollTwoFactor: false,
        user: response.data.user,
      };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      return {
        success: false,
        requires2FA: false,
        mustEnrollTwoFactor: true,
        error: resolveApiErrorMessage(apiError, "Nao foi possivel concluir o cadastro do 2FA"),
      };
    }
  }

  async function logout() {
    try {
      await api.post("/auth/logout", {}, { timeout: AUTH_REQUEST_TIMEOUT_MS });
    } catch (error) {
      console.error("Erro ao fazer logout no backend:", error);
    } finally {
      clearAuthState(false);
      router.push("/login");
    }
  }

  async function saveThemePreference(theme: AppThemePreference): Promise<AppThemePreference> {
    const normalizedTheme = normalizeAppThemePreference(theme);
    const previousTheme = normalizeAppThemePreference(user?.preferences?.theme);

    if (!user) {
      throw new Error("Usuario nao autenticado para alterar o tema");
    }

    if (normalizedTheme === previousTheme) {
      return previousTheme;
    }

    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      return withThemePreference(currentUser, normalizedTheme);
    });

    try {
      await api.patch(
        "/users/preferences",
        { theme: normalizedTheme },
        { timeout: AUTH_REQUEST_TIMEOUT_MS },
      );
      return normalizedTheme;
    } catch (error) {
      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        return withThemePreference(currentUser, previousTheme);
      });

      throw error;
    }
  }

  function updateUser(userData: Partial<User>) {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextPreferences = userData.preferences
        ? {
            ...(currentUser.preferences ?? {}),
            ...userData.preferences,
          }
        : currentUser.preferences;

      if (nextPreferences?.theme) {
        nextPreferences.theme = normalizeAppThemePreference(nextPreferences.theme);
      }

      const nextTenant = userData.tenant
        ? {
            ...(currentUser.tenant ?? {}),
            ...userData.tenant,
          }
        : currentUser.tenant;

      return {
        ...currentUser,
        ...userData,
        tenant: nextTenant,
        preferences: nextPreferences,
      };
    });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithCredentials,
        loginWith2FA,
        completeTwoFactorEnrollment,
        logout,
        saveThemePreference,
        updateUser,
      }}
    >
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
