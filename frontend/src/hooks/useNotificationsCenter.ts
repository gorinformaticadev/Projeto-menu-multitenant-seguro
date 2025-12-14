/**
 * HOOK PARA CENTRAL DE NOTIFICAÇÕES
 * 
 * Gerencia notificações com filtros, paginação e ações em lote
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsService } from '@/services/notifications.service';
import { Notification, NotificationFilters } from '@/types/notifications';

interface UseNotificationsCenterReturn {
  /** Notificações carregadas */
  notifications: Notification[];
  
  /** Contagem de não lidas */
  unreadCount: number;
  
  /** Total de notificações */
  total: number;
  
  /** Se há mais para carregar */
  hasMore: boolean;
  
  /** Estado de carregamento */
  loading: boolean;
  
  /** Carregando mais */
  loadingMore: boolean;
  
  /** Erro */
  error: string | null;
  
  /** Filtros ativos */
  filters: NotificationFilters;
  
  /** Aplicar filtros */
  setFilters: (filters: Partial<NotificationFilters>) => void;
  
  /** Carregar mais */
  loadMore: () => Promise<void>;
  
  /** Marcar como lida */
  markAsRead: (id: string) => Promise<void>;
  
  /** Marcar múltiplas como lidas */
  markMultipleAsRead: (ids: string[]) => Promise<void>;
  
  /** Marcar todas como lidas */
  markAllAsRead: () => Promise<void>;
  
  /** Deletar notificação */
  deleteNotification: (id: string) => Promise<void>;
  
  /** Deletar múltiplas */
  deleteMultiple: (ids: string[]) => Promise<void>;
  
  /** Recarregar */
  refresh: () => Promise<void>;
  
  /** Limpar erro */
  clearError: () => void;
  
  /** Seleção múltipla */
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

export function useNotificationsCenter(): UseNotificationsCenterReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filtros
  const [filters, setFiltersState] = useState<NotificationFilters>({
    severity: 'all',
    source: 'all',
    read: undefined,
    page: 1,
    limit: 20
  });
  
  // Refs para controle
  const isActiveRef = useRef(true);
  const currentRequestRef = useRef<AbortController | null>(null);

  /**
   * Carrega notificações do servidor
   */
  const loadNotifications = useCallback(async (
    newFilters?: Partial<NotificationFilters>,
    append = false,
    showLoading = true
  ) => {
    if (!user) return;

    // Cancela requisição anterior
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    const finalFilters = { ...filters, ...newFilters };
    
    if (showLoading) {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
    }
    setError(null);

    // Cria novo controller para cancelamento
    currentRequestRef.current = new AbortController();

    try {
      const response = await notificationsService.getCenterNotifications(finalFilters);
      
      if (isActiveRef.current) {
        if (append) {
          setNotifications(prev => [...prev, ...response.notifications]);
        } else {
          setNotifications(response.notifications);
        }
        
        setUnreadCount(response.unreadCount);
        setTotal(response.total);
        setHasMore(response.hasMore);
        
        // Atualiza filtros se necessário
        if (newFilters) {
          setFiltersState(finalFilters);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && isActiveRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
        setError(errorMessage);
        console.error('❌ Erro na central de notificações:', err);
      }
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      currentRequestRef.current = null;
    }
  }, [user, filters]);

  /**
   * Aplica novos filtros
   */
  const setFilters = useCallback((newFilters: Partial<NotificationFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setSelectedIds([]); // Limpa seleção ao filtrar
    loadNotifications(updatedFilters, false, true);
  }, [filters, loadNotifications]);

  /**
   * Carrega mais notificações
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    
    const nextPage = (filters.page || 1) + 1;
    await loadNotifications({ page: nextPage }, true, true);
  }, [hasMore, loadingMore, filters.page, loadNotifications]);

  /**
   * Marca uma notificação como lida
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      
      // Atualiza estado local
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id 
            ? { ...notif, read: true, readAt: new Date() }
            : notif
        )
      );
      
      // Atualiza contador se a notificação não estava lida
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    } catch (err) {
      console.error('❌ Erro ao marcar como lida:', err);
      throw err;
    }
  }, [notifications]);

  /**
   * Marca múltiplas notificações como lidas
   */
  const markMultipleAsRead = useCallback(async (ids: string[]) => {
    try {
      // Marca cada uma individualmente (pode ser otimizado no backend)
      await Promise.all(ids.map(id => notificationsService.markAsRead(id)));
      
      // Atualiza estado local
      setNotifications(prev => 
        prev.map(notif => 
          ids.includes(notif.id)
            ? { ...notif, read: true, readAt: new Date() }
            : notif
        )
      );
      
      // Atualiza contador
      const unreadIds = ids.filter(id => {
        const notif = notifications.find(n => n.id === id);
        return notif && !notif.read;
      });
      setUnreadCount(prev => Math.max(0, prev - unreadIds.length));
      
      // Limpa seleção
      setSelectedIds([]);
      
    } catch (err) {
      console.error('❌ Erro ao marcar múltiplas como lidas:', err);
      throw err;
    }
  }, [notifications]);

  /**
   * Marca todas as notificações como lidas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsService.markAllAsRead(filters);
      
      // Recarrega para sincronizar
      await loadNotifications(undefined, false, false);
      
    } catch (err) {
      console.error('❌ Erro ao marcar todas como lidas:', err);
      throw err;
    }
  }, [filters, loadNotifications]);

  /**
   * Deleta uma notificação
   */
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsService.deleteNotification(id);
      
      // Remove do estado local
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      setTotal(prev => prev - 1);
      
      // Atualiza contador se era não lida
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // Remove da seleção se estava selecionada
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      
    } catch (err) {
      console.error('❌ Erro ao deletar notificação:', err);
      throw err;
    }
  }, [notifications]);

  /**
   * Deleta múltiplas notificações
   */
  const deleteMultiple = useCallback(async (ids: string[]) => {
    try {
      await notificationsService.deleteNotifications(ids);
      
      // Remove do estado local
      const deletedNotifications = notifications.filter(n => ids.includes(n.id));
      const unreadDeleted = deletedNotifications.filter(n => !n.read).length;
      
      setNotifications(prev => prev.filter(notif => !ids.includes(notif.id)));
      setTotal(prev => prev - ids.length);
      setUnreadCount(prev => Math.max(0, prev - unreadDeleted));
      
      // Limpa seleção
      setSelectedIds([]);
      
    } catch (err) {
      console.error('❌ Erro ao deletar múltiplas notificações:', err);
      throw err;
    }
  }, [notifications]);

  /**
   * Recarrega notificações
   */
  const refresh = useCallback(async () => {
    setSelectedIds([]);
    await loadNotifications(undefined, false, true);
  }, [loadNotifications]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Alterna seleção de uma notificação
   */
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  }, []);

  /**
   * Seleciona todas as notificações visíveis
   */
  const selectAll = useCallback(() => {
    setSelectedIds(notifications.map(n => n.id));
  }, [notifications]);

  /**
   * Limpa seleção
   */
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Carrega notificações iniciais
   */
  useEffect(() => {
    if (user) {
      loadNotifications(undefined, false, true);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      setSelectedIds([]);
    }
  }, [user]); // Só depende do user para evitar loops

  /**
   * Cleanup ao desmontar
   */
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    filters,
    setFilters,
    loadMore,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteMultiple,
    refresh,
    clearError,
    selectedIds,
    setSelectedIds,
    toggleSelection,
    selectAll,
    clearSelection
  };
}