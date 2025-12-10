import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tipos para fila de falhas
interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

// Flag para evitar múltiplas renovações simultâneas
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });

  failedQueue = [];
};

// Interceptor de request para adicionar token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("@App:token")
      : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Função para fazer logout
const doLogout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("@App:token");
    localStorage.removeItem("@App:refreshToken");
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
  async (error: AxiosError | any) => {
    const originalRequest = error.config;

    // Erros que devem causar logout imediato
    const shouldLogout =
      error.response?.status === 401 || // Não autorizado
      error.response?.status === 403 || // Proibido (token inválido)
      error.response?.data?.message?.includes("token") || // Mensagens relacionadas a token
      error.response?.data?.message?.includes("expirado") ||
      error.response?.data?.message?.includes("expired") ||
      error.response?.data?.message?.includes("invalid");

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
      error.response?.status === 401 &&
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

      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("@App:refreshToken")
          : null;

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

        // Salvar novos tokens diretamente (sem criptografia Base64)
        if (typeof window !== "undefined") {
          localStorage.setItem("@App:token", accessToken);
          localStorage.setItem("@App:refreshToken", newRefreshToken);
        }

        // Atualizar header padrão
        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

        // Processar fila de requisições pendentes
        processQueue(null, accessToken);

        // Retentar requisição original
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
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
