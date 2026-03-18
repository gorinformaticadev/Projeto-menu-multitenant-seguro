'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api, { API_URL } from '@/lib/api';
import type { Notification as AppNotification } from '@/types/notifications';

interface SystemNotificationDto {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string | Date;
  isRead: boolean;
  readAt: string | Date | null;
}

interface SystemNotificationsResponse {
  notifications: SystemNotificationDto[];
  unreadCount: number;
}

interface UseSystemAdminNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isConnected: boolean;
  connectionError: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30000;

const severityToType = (severity: string): AppNotification['type'] => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

const parseDate = (value: string | Date | null | undefined): Date => {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
};

const mapSystemNotification = (row: SystemNotificationDto): AppNotification => {
  const createdAt = parseDate(row.createdAt);
  const readAt = row.readAt ? parseDate(row.readAt) : null;

  return {
    id: row.id,
    title: row.title,
    description: row.body,
    type: severityToType(row.severity),
    tenantId: null,
    userId: null,
    read: Boolean(row.isRead),
    readAt,
    createdAt,
    updatedAt: readAt || createdAt,
    metadata: row.data || {},
  };
};

const resolveApiBase = (): string => {
  const normalized = String(API_URL || '/api').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (typeof window === 'undefined') {
    return normalized || '/api';
  }

  const basePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${window.location.origin}${basePath}`;
};

export function useSystemAdminNotifications(): UseSystemAdminNotificationsReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const criticalToastCacheRef = useRef<Set<string>>(new Set());

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const applySnapshot = useCallback((payload: SystemNotificationsResponse) => {
    const mapped = Array.isArray(payload.notifications)
      ? payload.notifications.map((row) => mapSystemNotification(row)).slice(0, 20)
      : [];

    setNotifications(mapped);

    if (typeof payload.unreadCount === 'number') {
      setUnreadCount(Math.max(0, payload.unreadCount));
      return;
    }

    setUnreadCount(mapped.filter((row) => !row.read).length);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isSuperAdmin) {
      return;
    }

    const response = await api.get('/system/notifications', {
      params: {
        page: 1,
        limit: 20,
      },
    });

    applySnapshot(response.data || { notifications: [], unreadCount: 0 });
  }, [applySnapshot, isSuperAdmin]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      return;
    }

    pollTimerRef.current = setInterval(() => {
      void refreshNotifications().catch((error) => {
        setConnectionError(`Polling de notificacoes falhou: ${String(error)}`);
      });
    }, POLL_INTERVAL_MS);
  }, [refreshNotifications]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const pushIncomingNotification = useCallback(
    (raw: SystemNotificationDto) => {
      const mapped = mapSystemNotification(raw);

      setNotifications((previous) => {
        const withoutCurrent = previous.filter((entry) => entry.id !== mapped.id);
        return [mapped, ...withoutCurrent].slice(0, 20);
      });

      setUnreadCount((previous) => {
        if (mapped.read) {
          return previous;
        }
        return previous + 1;
      });

      if (mapped.type === 'error' && !criticalToastCacheRef.current.has(mapped.id)) {
        criticalToastCacheRef.current.add(mapped.id);
        toast({
          title: mapped.title || 'Alerta critico',
          description: mapped.description || 'Evento critico recebido.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const connectStream = useCallback(() => {
    if (!isSuperAdmin || typeof window === 'undefined') {
      return;
    }

    if (typeof window.EventSource === 'undefined') {
      setConnectionError('SSE nao suportado neste navegador. Usando polling.');
      setIsConnected(false);
      startPolling();
      return;
    }

    closeStream();

    const streamUrl = `${resolveApiBase()}/system/notifications/stream`;
    const stream = new window.EventSource(streamUrl);
    eventSourceRef.current = stream;

    stream.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
      stopPolling();
    };

    const handleEvent = (event: MessageEvent) => {
      if (!event?.data) {
        return;
      }

      try {
        const parsed = JSON.parse(String(event.data)) as SystemNotificationDto | { error?: string };
        if ((parsed as { error?: string }).error) {
          setConnectionError(String((parsed as { error?: string }).error));
          return;
        }

        pushIncomingNotification(parsed as SystemNotificationDto);
      } catch (error) {
        setConnectionError(`Falha ao processar evento SSE: ${String(error)}`);
      }
    };

    stream.onmessage = handleEvent;
    stream.addEventListener('system_alert', handleEvent as EventListener);

    stream.onerror = () => {
      setIsConnected(false);
      setConnectionError('Conexao SSE indisponivel. Fallback para polling ativado.');
      closeStream();
      startPolling();
    };
  }, [closeStream, isSuperAdmin, pushIncomingNotification, startPolling, stopPolling]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!isSuperAdmin) {
        return;
      }

      await api.post(`/system/notifications/${id}/read`);

      setNotifications((previous) =>
        previous.map((entry) =>
          entry.id === id
            ? { ...entry, read: true, readAt: new Date(), updatedAt: new Date() }
            : entry,
        ),
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    },
    [isSuperAdmin],
  );

  const markAllAsRead = useCallback(async () => {
    if (!isSuperAdmin) {
      return;
    }

    const unreadIds = notifications.filter((entry) => !entry.read).map((entry) => entry.id);
    if (unreadIds.length === 0) {
      return;
    }

    await Promise.all(unreadIds.map((id) => api.post(`/system/notifications/${id}/read`)));

    setNotifications((previous) =>
      previous.map((entry) => ({ ...entry, read: true, readAt: new Date(), updatedAt: new Date() })),
    );
    setUnreadCount(0);
  }, [isSuperAdmin, notifications]);

  useEffect(() => {
    if (!isSuperAdmin) {
      closeStream();
      stopPolling();
      setNotifications([]);
      setUnreadCount(0);
      setConnectionError(null);
      return;
    }

    void refreshNotifications().catch((error) => {
      setConnectionError(`Falha ao carregar notificacoes: ${String(error)}`);
    });

    connectStream();
    startPolling();

    return () => {
      closeStream();
      stopPolling();
    };
  }, [closeStream, connectStream, isSuperAdmin, refreshNotifications, startPolling, stopPolling]);

  return {
    notifications,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  };
}
