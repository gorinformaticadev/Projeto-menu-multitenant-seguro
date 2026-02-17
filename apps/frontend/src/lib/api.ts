import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

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

const api = axios.create({
  baseURL: API_URL === "/api" ? "" : API_URL,
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
  } catch (e) {
    // Ignora erro ao ler cookie
  }

  // Fallback para sessionStorage criptografado
  const encrypted = sessionStorage.getItem("@App:token");
  if (encrypted) {
    try {
      return atob(encrypted); // Descriptografia simples
    } catch (e) {
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
  } catch (e) {
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

const setSecureToken = async (token: string): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    document.cookie = `accessToken=${token}; Secure; SameSite=Strict; Max-Age=900; Path=/`;
  } catch {
    sessionStorage.setItem("@App:token", btoa(token));
  }
};

const setSecureRefreshToken = async (token: string): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    document.cookie = `refreshToken=${token}; Secure; SameSite=Strict; Max-Age=604800; Path=/`;
  } catch {
    sessionStorage.setItem("@App:refreshToken", btoa(token));
  }
};

// Interceptor de request para adicionar token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
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
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
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

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Salvar novos tokens de forma segura
        if (typeof window !== "undefined") {
          await setSecureToken(accessToken);
          await setSecureRefreshToken(newRefreshToken);
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
