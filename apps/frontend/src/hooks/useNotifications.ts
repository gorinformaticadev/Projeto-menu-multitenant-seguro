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
   * Marca notificação como lida
   */
  const markAsRead = useCallback((id: string) => {
    socketClient.markAsRead(id);
  }, []);

  /**
   * Marca todas as notificações como lidas
   */
  const markAllAsRead = useCallback(() => {
    socketClient.markAllAsRead();
  }, []);

  /**
   * Deleta uma notificação
   */
  const deleteNotification = useCallback((id: string) => {
    socketClient.deleteNotification(id);
  }, []);

  /**
   * Configura listeners do Socket.IO
   */
  const setupSocketListeners = useCallback(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    // Listener para nova notificação
    const handleNewNotification = (notification: Notification) => {
      if (!isActiveRef.current) return;

      // console.log('🔔 Nova notificação recebida:', notification);

      setNotifications(prev => {
        // Evitar duplicatas de socket/render
        if (prev.some(n => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev.slice(0, 9)];
      });

      // Só incrementa se for nova de verdade
      setUnreadCount(prev => prev + 1);

      // Reproduz som apenas para notificações novas
      playNotificationSound();
    };

    // Listener para notificação lida
    const handleNotificationRead = (notification: Notification) => {
      if (!isActiveRef.current) return;

      // console.log('👁️ Notificação marcada como lida:', notification.id);

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

      // console.log('🗑️ Notificação deletada:', data.id);

      setNotifications(prev => prev.filter(n => n.id !== data.id));
    };

    // Listener para todas marcadas como lidas
    const handleAllRead = (data: { count: number }) => {
      if (!isActiveRef.current) return;

      // console.log('✅ Todas as notificações marcadas como lidas:', data.count);

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

      // console.log('✅ Socket.IO conectado');
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
      // console.log('🔄 Hook: Buscando dados atualizados...');
      const [unreadRes, dropdownRes] = await Promise.all([
        api.get(`/notifications/unread-count?_t=${Date.now()}`),
        api.get(`/notifications/dropdown?_t=${Date.now()}`)
      ]);

      // console.log('📡 [Hook] Count API:', unreadRes.data);

      if (unreadRes.data && typeof unreadRes.data.count === 'number') {
        setUnreadCount(unreadRes.data.count);
        // console.log(`🔢 [Hook] Atualizando Count: -> ${unreadRes.data.count}`);
      }

      if (dropdownRes.data && Array.isArray(dropdownRes.data.notifications)) {
        setNotifications(dropdownRes.data.notifications);
        // console.log('📝 [Hook] Atualizando Lista:', dropdownRes.data.notifications.length);
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

      // 2. Conecta Socket.IO para updates em tempo real
      const socket = socketClient.connect(token);
      const cleanup = setupSocketListeners();

      return () => {
        if (cleanup) cleanup();
      };
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
      socketClient.disconnect();
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