import axios, { InternalAxiosRequestConfig } from "axios";
import {
  authAuthenticatedResponseSchemasByVersion,
  authLogoutBodySchema,
  authMessageResponseSchema,
  authPaths,
  authRefreshBodySchema,
} from "@contracts/auth";
import { API_CURRENT_VERSION, API_VERSION_HEADER } from "@contracts/http";
import { ROUTE_CONFIG } from "@/lib/routes";
import {
  hasPeerRefreshLock,
  publishAuthSyncEvent,
  releaseAuthRefreshLock,
  tryAcquireAuthRefreshLock,
  waitForAuthSyncEvent,
} from "@/lib/auth-sync";
import {
  parseContractValue,
  parseVersionedContractValue,
  resolveApiVersionFromHeaders,
} from "@/lib/contracts/contract-runtime";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
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
export const API_JSON_HEADERS = {
  "Content-Type": "application/json",
  [API_VERSION_HEADER]: API_CURRENT_VERSION,
} as const;

export const buildApiRequestHeaders = (
  headers?: Record<string, string>,
): Record<string, string> => ({
  ...API_JSON_HEADERS,
  ...(headers || {}),
});

const api = axios.create({
  baseURL: AXIOS_BASE_URL,
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-CSRF-Token",
  headers: buildApiRequestHeaders(),
});
api.defaults.headers.common[API_VERSION_HEADER] = API_CURRENT_VERSION;
api.defaults.headers.common["Content-Type"] = "application/json";

interface FailedRequest {
  resolve: () => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];
let logoutPromise: Promise<void> | null = null;

const processQueue = (error: unknown) => {
  failedQueue.forEach((pending) => {
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve();
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

const dispatchBrowserEvent = (eventName: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(eventName));
};

const waitForPeerRefreshOutcome = () =>
  waitForAuthSyncEvent(
    (event) =>
      event.type === "refresh-success" ||
      event.type === "refresh-failed" ||
      event.type === "logout",
  );

const doLogout = async () => {
  if (logoutPromise) {
    return logoutPromise;
  }

  logoutPromise = (async () => {
    if (typeof window === "undefined") {
      return;
    }

    document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    try {
      const isMaintenanceRequest = window.location.pathname.startsWith("/maintenance");
      if (!isMaintenanceRequest) {
        const logoutResponse = await axios.post(
          `${API_URL}${authPaths.logout}`,
          parseContractValue(authLogoutBodySchema, {}, authPaths.logout, "request"),
          {
            withCredentials: true,
            headers: buildApiRequestHeaders(),
          },
        );
        parseContractValue(
          authMessageResponseSchema,
          logoutResponse.data,
          authPaths.logout,
          "response",
        );
      }
    } catch (error) {
      console.warn("Forced logout request failed to propagate to server:", error);
    }

    publishAuthSyncEvent("logout");
    dispatchBrowserEvent("auth:logout");

    if (window.location.pathname !== ROUTE_CONFIG.unauthenticatedFallback) {
      window.location.href = ROUTE_CONFIG.unauthenticatedFallback;
    }
  })();

  try {
    await logoutPromise;
  } finally {
    logoutPromise = null;
  }
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.url && !/^https?:\/\//i.test(config.url) && config.url.startsWith("/api/")) {
      config.url = config.url.replace(/^\/api/, "");
    }

    if (!config.headers) {
      config.headers = buildApiRequestHeaders();
      return config;
    }

    const headersCandidate = config.headers as
      | { set?: (name: string, value: string) => void; has?: (name: string) => boolean }
      | Record<string, string>;

    if (typeof headersCandidate.set === "function") {
      if (!headersCandidate.has?.(API_VERSION_HEADER)) {
        headersCandidate.set(API_VERSION_HEADER, API_CURRENT_VERSION);
      }

      return config;
    }

    config.headers = buildApiRequestHeaders(headersCandidate as Record<string, string>);

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

    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;
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
      normalizedUrl === authPaths.login ||
      normalizedUrl === authPaths.login2fa ||
      normalizedUrl === authPaths.twoFactorEnrollmentEnable;
    const isRefreshRequest = normalizedUrl === authPaths.refresh;
    const shouldSkipRefresh = originalRequest.skipAuthRefresh === true;

    if (error.response?.status === 401 && isRefreshRequest) {
      await doLogout();
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isAuthLoginRequest &&
      !shouldSkipRefresh
    ) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((refreshError) => Promise.reject(refreshError));
      }

      if (hasPeerRefreshLock() && typeof window !== "undefined") {
        const peerOutcome = await waitForPeerRefreshOutcome();
        if (peerOutcome?.type === "refresh-success") {
          return api(originalRequest);
        }

        if (peerOutcome?.type === "refresh-failed" || peerOutcome?.type === "logout") {
          return Promise.reject(error);
        }
      }

      if (!tryAcquireAuthRefreshLock()) {
        const peerOutcome = await waitForPeerRefreshOutcome();
        if (peerOutcome?.type === "refresh-success") {
          return api(originalRequest);
        }

        if (peerOutcome?.type === "refresh-failed" || peerOutcome?.type === "logout") {
          return Promise.reject(error);
        }

        await doLogout();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      publishAuthSyncEvent("refresh-start");
      dispatchBrowserEvent("token-refresh-start");

      try {
        const refreshResponse = await axios.post(
          `${API_URL}${authPaths.refresh}`,
          parseContractValue(authRefreshBodySchema, {}, authPaths.refresh, "request"),
          {
            withCredentials: true,
            headers: buildApiRequestHeaders(),
          },
        );
        parseVersionedContractValue(
          authAuthenticatedResponseSchemasByVersion,
          refreshResponse.data,
          authPaths.refresh,
          "response",
          resolveApiVersionFromHeaders(refreshResponse.headers),
          {
            expectedVersion: API_CURRENT_VERSION,
            allowVersionFallback: resolveApiVersionFromHeaders(refreshResponse.headers) == null,
          },
        );

        publishAuthSyncEvent("refresh-success");
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError: unknown) {
        publishAuthSyncEvent("refresh-failed");
        processQueue(refreshError);
        await doLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        releaseAuthRefreshLock();
        dispatchBrowserEvent("token-refresh-end");
      }
    }

    return Promise.reject(error);
  },
);

export default api;
