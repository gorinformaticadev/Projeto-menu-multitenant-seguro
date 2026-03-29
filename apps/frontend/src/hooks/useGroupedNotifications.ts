/**
 * USE GROUPED NOTIFICATIONS - Hook para notificações agrupadas
 */

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type {
  NotificationGroup,
  NotificationGroupListResponse,
  NotificationGroupItemsResponse,
} from '@/types/notifications';

interface UseGroupedNotificationsReturn {
  groups: NotificationGroup[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  fetchGroups: (page?: number) => Promise<void>;
  fetchGroupItems: (groupId: string, page?: number) => Promise<NotificationGroupItemsResponse | null>;
  markGroupAsRead: (groupId: string) => Promise<number>;
}

export function useGroupedNotifications(endpoint: string = '/notifications'): UseGroupedNotificationsReturn {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchGroups = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<NotificationGroupListResponse>(
        `${endpoint}/grouped`,
        { params: { page, limit: 20 } },
      );

      const data = response.data;
      if (page === 1) {
        setGroups(data.groups || []);
      } else {
        setGroups((prev) => [...prev, ...(data.groups || [])]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const fetchGroupItems = useCallback(async (
    groupId: string,
    page: number = 1,
  ): Promise<NotificationGroupItemsResponse | null> => {
    try {
      const response = await api.get<NotificationGroupItemsResponse>(
        `${endpoint}/groups/${encodeURIComponent(groupId)}/items`,
        { params: { page, limit: 20 } },
      );
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar itens do grupo');
      return null;
    }
  }, [endpoint]);

  const markGroupAsRead = useCallback(async (groupId: string): Promise<number> => {
    try {
      const response = await api.patch<{ success: boolean; count: number }>(
        `${endpoint}/groups/${encodeURIComponent(groupId)}/read-all`,
      );

      if (response.data.success) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, unreadCount: 0 } : g,
          ),
        );
      }

      return response.data.count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao marcar grupo como lido');
      return 0;
    }
  }, [endpoint]);

  return {
    groups,
    loading,
    error,
    total,
    hasMore,
    fetchGroups,
    fetchGroupItems,
    markGroupAsRead,
  };
}
