/**
 * USE NOTIFICATIONS - Hook principal para notificações Socket.IO
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketClient } from '@/lib/socket';
import { Notification } from '@/types/notifications';
import api from '@/lib/api';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  connectionError: string | null;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  playNotificationSound: () => void;
  refreshNotifications: () => Promise<void>;
}

// Flag para controlar se o Socket.IO está habilitado
const SOCKET_ENABLED = false; // TEMPORARIAMENTE DESABILITADO

export function useNotifications(): UseNotificationsReturn {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const isActiveRef = useRef(true);

  /**
   * Reproduz som de notificação
   */
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.warn('Não foi possível reproduzir som de notificação:', error);
      });
    } catch (error) {
      console.warn('Erro ao tentar reproduzir som:', error);
    }
  }, []);

  /**
   * Marca notificação como lida (via REST quando Socket desabilitado)
   */
  const markAsRead = useCallback(async (id: string) => {
    if (SOCKET_ENABLED) {
      socketClient.markAsRead(id);
    } else {
      // Fallback para REST API
      try {
        await api.put(`/notifications/${id}/read`);
        setNotifications(prev =>
          prev.map(n =>
            n.id === id
              ? { ...n, read: true, readAt: new Date() }
              : n
          )
        );
        // Atualizar contagem
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }
  }, []);

  /**
   * Marca todas as notificações como lidas (via REST quando Socket desabilitado)
   */
  const markAllAsRead = useCallback(async () => {
    if (SOCKET_ENABLED) {
      socketClient.markAllAsRead();
    } else {
      // Fallback para REST API
      try {
        await api.put('/notifications/mark-all-read');
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      } catch (error) {
        console.error('Erro ao marcar todas como lidas:', error);
      }
    }
  }, []);

  /**
   * Deleta uma notificação (via REST quando Socket desabilitado)
   */
  const deleteNotification = useCallback(async (id: string) => {
    if (SOCKET_ENABLED) {
      socketClient.deleteNotification(id);
    } else {
      // Fallback para REST API
      try {
        await api.delete(`/notifications/${id}`);
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Se era não lida, decrementar contador
        const notification = notifications.find(n => n.id === id);
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Erro ao deletar notificação:', error);
      }
    }
  }, [notifications]);

  /**
   * Configura listeners do Socket.IO (apenas se habilitado)
   */
  const setupSocketListeners = useCallback(() => {
    if (!SOCKET_ENABLED) return null;

    const socket = socketClient.getSocket();
    if (!socket) return null;

    // Listener para nova notificação
    const handleNewNotification = (notification: Notification) => {
      if (!isActiveRef.current) return;

      setNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev.slice(0, 9)];
      });

      setUnreadCount(prev => prev + 1);
      playNotificationSound();
    };

    // Listener para notificação lida
    const handleNotificationRead = (notification: Notification) => {
      if (!isActiveRef.current) return;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, read: true, readAt: new Date() }
            : n
        )
      );
    };

    // Listener para notificação deletada
    const handleNotificationDeleted = (data: { id: string }) => {
      if (!isActiveRef.current) return;

      setNotifications(prev => prev.filter(n => n.id !== data.id));
    };

    // Listener para todas marcadas como lidas
    const handleAllRead = (data: { count: number }) => {
      if (!isActiveRef.current) return;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    };

    // Listener para contagem de não lidas
    const handleUnreadCount = (data: { count: number }) => {
      if (!isActiveRef.current) return;

      setUnreadCount(data.count);
    };

    // Listener para erros
    const handleError = (data: { message: string }) => {
      if (!isActiveRef.current) return;

      console.error('❌ Erro de notificação:', data.message);
      setConnectionError(data.message);
    };

    // Listeners de conexão
    const handleConnect = () => {
      if (!isActiveRef.current) return;

      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      if (!isActiveRef.current) return;

      console.log('❌ Socket.IO desconectado');
      setIsConnected(false);
    };

    const handleConnectError = (error: any) => {
      if (!isActiveRef.current) return;

      console.error('❌ Erro de conexão Socket.IO:', error);
      setConnectionError('Erro de conexão');
      setIsConnected(false);
    };

    // Registrar todos os listeners
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:deleted', handleNotificationDeleted);
    socket.on('notification:all-read', handleAllRead);
    socket.on('notification:unread-count', handleUnreadCount);
    socket.on('notification:error', handleError);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Função de cleanup
    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleNotificationRead);
      socket.off('notification:deleted', handleNotificationDeleted);
      socket.off('notification:all-read', handleAllRead);
      socket.off('notification:unread-count', handleUnreadCount);
      socket.off('notification:error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [playNotificationSound]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Busca dados atualizados via REST
   */
  const refreshNotifications = useCallback(async () => {
    if (!user || !token) return;

    try {
      const [unreadRes, dropdownRes] = await Promise.all([
        api.get(`/notifications/unread-count?_t=${Date.now()}`),
        api.get(`/notifications/dropdown?_t=${Date.now()}`)
      ]);

      if (unreadRes.data && typeof unreadRes.data.count === 'number') {
        setUnreadCount(unreadRes.data.count);
      }

      if (dropdownRes.data && Array.isArray(dropdownRes.data.notifications)) {
        setNotifications(dropdownRes.data.notifications);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar notificações:', error);
    }
  }, [user, token]);

  /**
   * Conecta/desconecta e busca dados iniciais REST
   */
  useEffect(() => {
    if (user && token) {
      // 1. Fetch inicial via REST (Garante dados mesmo sem socket)
      const fetchInitialData = async () => {
        try {
          const [unreadRes, dropdownRes] = await Promise.all([
            api.get('/notifications/unread-count'),
            api.get('/notifications/dropdown')
          ]);

          if (unreadRes.data && typeof unreadRes.data.count === 'number') {
            setUnreadCount(unreadRes.data.count);
          }

          if (dropdownRes.data && Array.isArray(dropdownRes.data.notifications)) {
            setNotifications(dropdownRes.data.notifications);
          }
        } catch (error) {
          console.error('❌ Erro ao buscar dados iniciais de notificação:', error);
        }
      };

      fetchInitialData();

      // 2. Socket.IO para updates em tempo real (apenas se habilitado)
      if (SOCKET_ENABLED) {
        const socket = socketClient.connect(token);
        const cleanup = setupSocketListeners();

        return () => {
          if (cleanup) cleanup();
        };
      } else {
        // Se Socket desabilitado, definir estado como desconectado
        setIsConnected(false);
        setConnectionError('Socket.IO temporariamente desabilitado');
      }
    } else {
      socketClient.disconnect();
      setNotifications([]);
      setUnreadCount(0);
      setIsConnected(false);
      setConnectionError(null);
    }
  }, [user, token, setupSocketListeners]);

  /**
   * Cleanup ao desmontar
   */
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (SOCKET_ENABLED) {
        socketClient.disconnect();
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    playNotificationSound,
    refreshNotifications,
  };
}