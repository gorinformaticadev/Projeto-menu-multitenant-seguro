/**
 * HOOK PARA DROPDOWN DE NOTIFICAÇÕES
 * 
 * Gerencia as últimas 15 notificações para exibição na topbar
 * INTEGRADO COM SSE - Atualiza em tempo real
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsService } from '@/services/notifications.service';
import { Notification } from '@/types/notifications';
import { useNotificationSSEIntegration } from './useNotificationSSEIntegration';

interface UseNotificationsDropdownReturn {
  /** Notificações para o dropdown (máximo 15) */
  notifications: Notification[];
  
  /** Contagem de não lidas */
  unreadCount: number;
  
  /** Estado de carregamento */
  loading: boolean;
  
  /** Erro */
  error: string | null;
  
  /** Marcar como lida */
  markAsRead: (id: string) => Promise<void>;
  
  /** Marcar todas como lidas */
  markAllAsRead: () => Promise<void>;
  
  /** Recarregar manualmente */
  refresh: () => Promise<void>;
  
  /** Limpar erro */
  clearError: () => void;
}

export function useNotificationsDropdown(): UseNotificationsDropdownReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs para controle de polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  
  // Integração SSE
  const { isConnected, playNotificationSound } = useNotificationSSEIntegration({
    onNewNotification: (notification) => {
      // Recarrega notificações quando recebe nova via SSE
      loadNotifications(false);
      playNotificationSound();
    },
    onNotificationRead: () => {
      // Recarrega quando notificação é lida via SSE
      loadNotifications(false);
    },
    onNotificationDeleted: () => {
      // Recarrega quando notificação é deletada via SSE
      loadNotifications(false);
    }
  });
  
  // Configurações - Reduz polling quando SSE está conectado
  const POLLING_INTERVAL = isConnected ? 60000 : 30000; // 60s com SSE, 30s sem SSE
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // 5 segundos

  /**
   * Carrega notificações do servidor
   */
  const loadNotifications = useCallback(async (showLoading = false) => {
    if (!user) return;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await notificationsService.getDropdownNotifications();
      
      if (isActiveRef.current) {
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      }
    } catch (err) {
      if (isActiveRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar notificações';
        setError(errorMessage);
        console.error('❌ Erro no dropdown de notificações:', err);
      }
    } finally {
      if (showLoading && isActiveRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  /**
   * Marca uma notificação como lida
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      
      // Atualiza estado local imediatamente
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id 
            ? { ...notif, read: true, readAt: new Date() }
            : notif
        )
      );
      
      // Atualiza contador
      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (err) {
      console.error('❌ Erro ao marcar como lida:', err);
      // Recarrega para sincronizar
      await loadNotifications();
    }
  }, [loadNotifications]);

  /**
   * Marca todas as notificações como lidas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsService.markAllAsRead();
      
      // Atualiza estado local
      setNotifications(prev => 
        prev.map(notif => ({ 
          ...notif, 
          read: true, 
          readAt: new Date() 
        }))
      );
      setUnreadCount(0);
      
    } catch (err) {
      console.error('❌ Erro ao marcar todas como lidas:', err);
      // Recarrega para sincronizar
      await loadNotifications();
    }
  }, [loadNotifications]);

  /**
   * Recarrega notificações manualmente
   */
  const refresh = useCallback(async () => {
    await loadNotifications(true);
  }, [loadNotifications]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Configura polling - Reduzido quando SSE está ativo
   */
  const startPolling = useCallback(() => {
    // Limpa polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Carrega imediatamente
    loadNotifications(true);

    // Configura polling (menos frequente se SSE está conectado)
    pollingIntervalRef.current = setInterval(() => {
      if (isActiveRef.current && document.visibilityState === 'visible') {
        loadNotifications(false);
      }
    }, POLLING_INTERVAL);
  }, [loadNotifications, POLLING_INTERVAL]);

  /**
   * Para polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Inicia/para polling baseado no usuário e status SSE
   */
  useEffect(() => {
    if (user) {
      startPolling();
    } else {
      stopPolling();
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      stopPolling();
    };
  }, [user, startPolling, stopPolling, isConnected]);

  /**
   * Pausa polling quando página não está visível
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Recarrega quando volta a ficar visível
        loadNotifications(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, loadNotifications]);

  /**
   * Cleanup ao desmontar
   */
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  /**
   * Escuta eventos de notificação do sistema
   */
  useEffect(() => {
    const handleNotificationEvent = (event: CustomEvent) => {
      // Recarrega quando há nova notificação
      loadNotifications(false);
    };

    window.addEventListener('newNotification', handleNotificationEvent as EventListener);
    return () => {
      window.removeEventListener('newNotification', handleNotificationEvent as EventListener);
    };
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
    clearError
  };
}