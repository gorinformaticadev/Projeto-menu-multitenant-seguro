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

const MAINTENANCE_STORAGE_KEY = "__maintenance_state";
const MAINTENANCE_EVENT_ACTIVE = "maintenance-mode";

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
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-CSRF-Token",
  headers: {
    "Content-Type": "application/json",
  },
});

interface FailedRequest {
  resolve: () => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

const normalizeMaintenancePayload = (data: MaintenanceModePayload) => ({
  enabled: true,
  reason: data.reason || data.message || "Atualizacao em andamento",
  startedAt: data.startedAt || null,
  etaSeconds: Number.isFinite(Number(data.etaSeconds)) ? Number(data.etaSeconds) : null,
  allowedRoles: ["SUPER_ADMIN"],
  bypassHeader: "X-Maintenance-Bypass",
});

const publishMaintenanceState = (payload: MaintenanceModePayload) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeMaintenancePayload(payload);
  window.sessionStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT_ACTIVE, { detail: normalized }));
};

const doLogout = async () => {
  if (typeof window === "undefined") {
    return;
  }

  // Limpar os cookies para precaver (embora HttpOnly precise do backend)
  document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

  try {
    const isMaintenanceRequest = window.location.pathname.startsWith("/maintenance");
    
    // Se não estiver em manutenção, tenta o logout para limpar cookies HttpOnly no backend
    if (!isMaintenanceRequest) {
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (e) {
    console.warn("Forced logout request failed to propagate to server:", e);
  }

  window.dispatchEvent(new Event("auth:logout"));

  if (window.location.pathname !== ROUTE_CONFIG.unauthenticatedFallback) {
    window.location.href = ROUTE_CONFIG.unauthenticatedFallback;
  }
};



api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.url && !/^https?:\/\//i.test(config.url) && config.url.startsWith("/api/")) {
      config.url = config.url.replace(/^\/api/, "");
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as CustomAxiosRequestConfig;
    const maintenancePayload = error.response?.data as MaintenanceModePayload | undefined;

    if (
      error.response?.status === 503 &&
      String(maintenancePayload?.error || "").trim().toUpperCase() === "MAINTENANCE_MODE"
    ) {
      publishMaintenanceState(maintenancePayload || {});
      return Promise.reject(error);
    }

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const normalizedUrl = String(originalRequest.url || "");
    const isAuthLoginRequest =
      normalizedUrl === "/auth/login" ||
      normalizedUrl === "/auth/login-2fa" ||
      normalizedUrl === "/auth/2fa/enrollment/enable";
    const isRefreshRequest = normalizedUrl === "/auth/refresh";

    if (error.response?.status === 401 && isRefreshRequest) {
      await doLogout();
      return Promise.reject(error);
    }


    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isAuthLoginRequest
    ) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((refreshError) => Promise.reject(refreshError));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        processQueue(null);
        return api(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError);
        await doLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
