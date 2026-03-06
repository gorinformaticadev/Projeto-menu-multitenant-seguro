"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type NotificationSeverity = "info" | "warning" | "critical";

export type SystemNotification = {
  id: string;
  createdAt: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
};

export type ContextState = {
  items: SystemNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isDrawerOpen: boolean;
  isEnabled: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

interface BackendSystemNotification {
  id?: string;
  createdAt?: string | Date;
  type?: string;
  severity?: string;
  title?: string;
  body?: string;
  data?: unknown;
  isRead?: boolean;
  readAt?: string | Date | null;
}

interface BackendNotificationsListResponse {
  notifications?: BackendSystemNotification[];
  unreadCount?: number;
}

interface BackendUnreadCountResponse {
  count?: number;
}

const POLL_INTERVAL_MS = 30000;
const LIST_LIMIT = 20;
const KNOWN_NOTIFICATIONS_MAX = 500;

const SystemNotificationsContext = createContext<ContextState | undefined>(undefined);

const toIsoString = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const normalizeSeverity = (value: unknown): NotificationSeverity => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "warning") {
    return "warning";
  }
  return "info";
};

const normalizeData = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const mapNotification = (row: BackendSystemNotification): SystemNotification | null => {
  if (!row?.id) {
    return null;
  }

  const createdAt = toIsoString(row.createdAt) || new Date().toISOString();
  const readAt = toIsoString(row.readAt);

  return {
    id: String(row.id),
    createdAt,
    type: String(row.type || "SYSTEM_ALERT"),
    severity: normalizeSeverity(row.severity),
    title: String(row.title || "Notificacao do sistema"),
    body: String(row.body || ""),
    data: normalizeData(row.data),
    isRead: Boolean(row.isRead),
    readAt,
  };
};

const normalizeErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.message === "string" && error.response.data.message) {
      return error.response.data.message;
    }
    if (typeof error.message === "string" && error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erro desconhecido";
};

export function SystemNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedAtLeastOnceRef = useRef(false);
  const itemsRef = useRef<SystemNotification[]>([]);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isEnabled = isSuperAdmin && !accessDenied;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const registerKnownIds = useCallback((ids: string[]) => {
    const allIds = [...ids, ...knownIdsRef.current];
    knownIdsRef.current = new Set(allIds.slice(0, KNOWN_NOTIFICATIONS_MAX));
  }, []);

  const handleAccessDenied = useCallback(() => {
    setAccessDenied(true);
    setItems([]);
    setUnreadCount(0);
    setError(null);
    setLoading(false);
    setIsDrawerOpen(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!isSuperAdmin || accessDenied) {
      return;
    }

    setLoading(true);
    try {
      const [listResponse, unreadResponse] = await Promise.all([
        api.get<BackendNotificationsListResponse>("/system/notifications", {
          params: {
            page: 1,
            limit: LIST_LIMIT,
          },
        }),
        api.get<BackendUnreadCountResponse>("/system/notifications/unread-count"),
      ]);

      const mapped = Array.isArray(listResponse.data?.notifications)
        ? listResponse.data.notifications.map(mapNotification).filter((value): value is SystemNotification => Boolean(value))
        : [];

      if (!hasLoadedAtLeastOnceRef.current) {
        registerKnownIds(mapped.map((item) => item.id));
        hasLoadedAtLeastOnceRef.current = true;
      } else {
        const newCriticalItems = mapped.filter(
          (item) => item.severity === "critical" && !knownIdsRef.current.has(item.id),
        );

        for (const item of newCriticalItems) {
          toast({
            title: item.title || "Alerta critico",
            description: item.body || "Nova notificacao critica do sistema.",
            variant: "destructive",
          });
        }

        registerKnownIds(mapped.map((item) => item.id));
      }

      setItems(mapped);
      const unreadFromEndpoint = Number(unreadResponse.data?.count);
      if (Number.isFinite(unreadFromEndpoint) && unreadFromEndpoint >= 0) {
        setUnreadCount(unreadFromEndpoint);
      } else if (typeof listResponse.data?.unreadCount === "number") {
        setUnreadCount(Math.max(0, listResponse.data.unreadCount));
      } else {
        setUnreadCount(mapped.filter((item) => !item.isRead).length);
      }
      setError(null);
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        handleAccessDenied();
        return;
      }

      setError(`Falha ao carregar notificacoes do sistema: ${normalizeErrorMessage(requestError)}`);
    } finally {
      setLoading(false);
    }
  }, [accessDenied, handleAccessDenied, isSuperAdmin, registerKnownIds, toast]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!id || !isSuperAdmin || accessDenied) {
        return;
      }

      const target = itemsRef.current.find((item) => item.id === id);
      const shouldDecrement = Boolean(target && !target.isRead);

      try {
        await api.post(`/system/notifications/${encodeURIComponent(id)}/read`);
        const now = new Date().toISOString();

        setItems((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isRead: true,
                  readAt: item.readAt || now,
                }
              : item,
          ),
        );

        if (shouldDecrement) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }
      } catch (requestError) {
        if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
          handleAccessDenied();
          return;
        }

        setError(`Falha ao marcar notificacao como lida: ${normalizeErrorMessage(requestError)}`);
      }
    },
    [accessDenied, handleAccessDenied, isSuperAdmin],
  );

  const markAllAsRead = useCallback(async () => {
    if (!isSuperAdmin || accessDenied) {
      return;
    }

    try {
      await api.post("/system/notifications/read-all");
      const now = new Date().toISOString();

      setItems((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || now,
        })),
      );
      setUnreadCount(0);
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        handleAccessDenied();
        return;
      }

      setError(`Falha ao marcar notificacoes como lidas: ${normalizeErrorMessage(requestError)}`);
    }
  }, [accessDenied, handleAccessDenied, isSuperAdmin]);

  const openDrawer = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    setIsDrawerOpen(true);
    void refresh();
  }, [isEnabled, refresh]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      setIsDrawerOpen(false);
      setAccessDenied(false);
      knownIdsRef.current.clear();
      hasLoadedAtLeastOnceRef.current = false;
      return;
    }

    if (accessDenied) {
      return;
    }

    void refresh();

    const intervalRef = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef);
    };
  }, [accessDenied, isSuperAdmin, refresh]);

  const value = useMemo<ContextState>(
    () => ({
      items,
      unreadCount,
      loading,
      error,
      isDrawerOpen,
      isEnabled,
      openDrawer,
      closeDrawer,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [closeDrawer, error, isDrawerOpen, isEnabled, items, loading, markAllAsRead, markAsRead, openDrawer, refresh, unreadCount],
  );

  return <SystemNotificationsContext.Provider value={value}>{children}</SystemNotificationsContext.Provider>;
}

export function useSystemNotificationsContext(): ContextState {
  const context = useContext(SystemNotificationsContext);
  if (!context) {
    throw new Error("useSystemNotificationsContext deve ser usado dentro de SystemNotificationsProvider");
  }

  return context;
}
