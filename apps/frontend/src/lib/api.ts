import axios, { InternalAxiosRequestConfig } from "axios";
import { ROUTE_CONFIG } from "@/lib/routes";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}
interface MaintenanceModePayload {
  error?: string;
  message?: string;
  reason?: string;
  etaSeconds?: number | null;
  startedAt?: string | null;
}

type TokenRefreshPayload = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
};

const MAINTENANCE_STORAGE_KEY = '__maintenance_state';
const MAINTENANCE_EVENT_ACTIVE = 'maintenance-mode';

const normalizeApiUrl = (value?: string): string => {
  const raw = (value || "/api").trim();
  if (!raw) {
    return "/api";
  }

  const noTrailingSlash = raw.replace(/\/+$/, "");
  const isAbsolute = /^https?:\/\//i.test(noTrailingSlash);

  if (!isAbsolute) {
    return noTrailingSlash || "/api";
  }

  return noTrailingSlash.endsWith("/api") ? noTrailingSlash : `${noTrailingSlash}/api`;
};

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const AXIOS_BASE_URL = API_URL === "/api" ? "/api" : API_URL;

const api = axios.create({
  baseURL: AXIOS_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tipos para fila de falhas
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

// Flag para evitar múltiplas renovações simultâneas
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });

  failedQueue = [];
};


const normalizeMaintenancePayload = (data: MaintenanceModePayload) => ({
  enabled: true,
  reason: data.reason || data.message || 'Atualizacao em andamento',
  startedAt: data.startedAt || null,
  etaSeconds: Number.isFinite(Number(data.etaSeconds)) ? Number(data.etaSeconds) : null,
  allowedRoles: ['SUPER_ADMIN'],
  bypassHeader: 'X-Maintenance-Bypass',
});

const publishMaintenanceState = (payload: MaintenanceModePayload) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeMaintenancePayload(payload);
  window.sessionStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT_ACTIVE, { detail: normalized }));
};

const resolveCookieMaxAgeSeconds = (
  expiresAt: string | null | undefined,
  fallbackSeconds: number,
): number => {
  if (!expiresAt) {
    return fallbackSeconds;
  }

  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) {
    return fallbackSeconds;
  }

  const seconds = Math.floor((parsed - Date.now()) / 1000);
  return seconds > 0 ? seconds : fallbackSeconds;
};

// Funções para gerenciamento seguro de tokens
export const getSecureToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  try {
    // Tentar ler do cookie primeiro
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('accessToken='));
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
  } catch {
    // Ignora erro ao ler cookie
  }

  // Fallback para sessionStorage criptografado
  const encrypted = sessionStorage.getItem("@App:token");
  if (encrypted) {
    try {
      return atob(encrypted); // Descriptografia simples
    } catch {
      // Erro ao decodificar token
      return null;
    }
  }

  return null;
};

const getSecureRefreshToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  try {
    // Tentar ler do cookie primeiro
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('refreshToken='));
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
  } catch {
    // Ignora erro ao ler cookie
  }

  // Fallback para sessionStorage criptografado
  const encrypted = sessionStorage.getItem("@App:refreshToken");
  if (encrypted) {
    try {
      return atob(encrypted); // Descriptografia simples
    } catch {
      return null;
    }
  }

  return null;
};

const setSecureToken = async (
  token: string,
  expiresAt?: string | null,
): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    const maxAgeSeconds = resolveCookieMaxAgeSeconds(expiresAt, 900);
    document.cookie = `accessToken=${token}; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}; Path=/`;
  } catch {
    sessionStorage.setItem("@App:token", btoa(token));
  }
};

const setSecureRefreshToken = async (
  token: string,
  expiresAt?: string | null,
): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    const maxAgeSeconds = resolveCookieMaxAgeSeconds(expiresAt, 604800);
    document.cookie = `refreshToken=${token}; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}; Path=/`;
  } catch {
    sessionStorage.setItem("@App:refreshToken", btoa(token));
  }
};

// Interceptor de request para adicionar token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Normaliza chamadas para evitar /api/api/* quando a URL já vem prefixada.
    if (config.url && !/^https?:\/\//i.test(config.url) && config.url.startsWith("/api/")) {
      config.url = config.url.replace(/^\/api/, "");
    }

    const token = await getSecureToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Função para fazer logout seguro
const doLogout = () => {
  if (typeof window !== "undefined") {
    // Limpar cookies
    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // Limpar sessionStorage
    sessionStorage.removeItem("@App:token");
    sessionStorage.removeItem("@App:refreshToken");
    delete api.defaults.headers.common["Authorization"];

    // Redirecionar apenas se não estiver já na página de login
    if (window.location.pathname !== ROUTE_CONFIG.unauthenticatedFallback) {
      window.location.href = ROUTE_CONFIG.unauthenticatedFallback;
    }
  }
};

// Interceptor para renovação automática de tokens
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as CustomAxiosRequestConfig;
    const axiosError = error;
    const maintenancePayload = axiosError.response?.data as MaintenanceModePayload | undefined;
    if (
      axiosError.response?.status === 503 &&
      String(maintenancePayload?.error || '').trim().toUpperCase() === 'MAINTENANCE_MODE'
    ) {
      publishMaintenanceState(maintenancePayload || {});
      return Promise.reject(error);
    }

    // Erros que devem causar logout imediato
    const shouldLogout =
      axiosError.response?.status === 401 || // Não autorizado
      axiosError.response?.status === 403 || // Proibido (token inválido)
      (axiosError.response?.data?.message && (
        axiosError.response.data.message.includes("token") || // Mensagens relacionadas a token
        axiosError.response.data.message.includes("expirado") ||
        axiosError.response.data.message.includes("expired") ||
        axiosError.response.data.message.includes("invalid")
      ));

    // Se for erro de autenticação em endpoints de login/refresh, não tentar renovar
    if (
      shouldLogout &&
      originalRequest &&
      (originalRequest.url === "/auth/refresh" ||
        originalRequest.url === "/auth/login")
    ) {
      doLogout();
      return Promise.reject(error);
    }

    // Se o erro for 401 e não for uma tentativa de refresh
    if (
      axiosError.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh" &&
      originalRequest.url !== "/auth/login"
    ) {
      if (isRefreshing) {
        // Se já está renovando, adiciona à fila
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await getSecureRefreshToken();

      if (!refreshToken) {
        // Sem refresh token, fazer logout
        doLogout();
        return Promise.reject(error);
      }

      try {
        // Tentar renovar o token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const {
          accessToken,
          refreshToken: newRefreshToken,
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
        } = response.data as TokenRefreshPayload;

        // Salvar novos tokens de forma segura
        if (typeof window !== "undefined") {
          await setSecureToken(accessToken, accessTokenExpiresAt);
          await setSecureRefreshToken(newRefreshToken, refreshTokenExpiresAt);
        }

        // Atualizar header padrão
        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

        // Processar fila de requisições pendentes
        processQueue(null, accessToken);

        // Retentar requisição original
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: unknown) {
        // Falha ao renovar, fazer logout
        processQueue(refreshError, null);
        doLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;


