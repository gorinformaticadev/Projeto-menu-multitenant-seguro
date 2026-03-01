/**
 * USE NOTIFICATIONS - Hook principal para notificações Socket.IO
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketClient } from '@/lib/socket';
import type { Notification as AppNotification } from '@/types/notifications';
import api from '@/lib/api';

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isConnected: boolean;
  connectionError: string | null;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  playNotificationSound: () => void;
  refreshNotifications: () => Promise<void>;
}

interface BrowserPushSubscriptionPayload {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

// Flag para controlar se o Socket.IO está habilitado
const SOCKET_ENABLED = true;

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export function useNotifications(): UseNotificationsReturn {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const isActiveRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const permissionAskedRef = useRef(false);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const initAudio = useCallback(() => {
    if (audioRef.current || typeof window === 'undefined') return;

    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.5;
    audio.preload = 'auto';
    audioRef.current = audio;
  }, []);

  const requestBrowserNotificationPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (window.Notification.permission !== 'default') return window.Notification.permission;
    if (permissionAskedRef.current) return window.Notification.permission;

    permissionAskedRef.current = true;

    try {
      await window.Notification.requestPermission();
    } catch (error) {
      console.warn('Nao foi possivel solicitar permissao de notificacao:', error);
    }
    return window.Notification.permission;
  }, []);

  const showBrowserNotification = useCallback((notification: AppNotification) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return;

    const isBackground = document.hidden || !document.hasFocus();
    if (!isBackground) return;

    try {
      const nativeNotification = new window.Notification(notification.title || 'Nova notificacao', {
        body: notification.description || '',
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `notification-${notification.id}`,
        renotify: true,
        silent: false,
      });

      nativeNotification.onclick = () => {
        window.focus();
        nativeNotification.close();
      };
    } catch (error) {
      console.warn('Erro ao exibir notificacao nativa:', error);
    }
  }, []);

  const getPushPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const response = await api.get('/notifications/push/public-key');
      const publicKey = response?.data?.publicKey;

      if (response?.data?.enabled && typeof publicKey === 'string' && publicKey.length > 0) {
        return publicKey;
      }
    } catch (error) {
      console.warn('Nao foi possivel carregar chave publica de push:', error);
    }

    return null;
  }, []);

  const syncPushSubscription = useCallback(async (subscription: PushSubscription) => {
    try {
      const data = subscription.toJSON() as BrowserPushSubscriptionPayload;
      const endpoint = data?.endpoint;
      const p256dh = data?.keys?.p256dh;
      const auth = data?.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        return;
      }

      await api.post('/notifications/push/subscribe', {
        endpoint,
        keys: { p256dh, auth },
      });
    } catch (error) {
      console.warn('Nao foi possivel sincronizar assinatura push:', error);
    }
  }, []);

  const registerPushSubscription = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return;
    if (!window.isSecureContext) return;

    try {
      const registeredWorker =
        serviceWorkerRegistrationRef.current || (await navigator.serviceWorker.register('/sw.js'));
      serviceWorkerRegistrationRef.current = registeredWorker;

      const readyWorker = await navigator.serviceWorker.ready;
      serviceWorkerRegistrationRef.current = readyWorker;

      let subscription = await readyWorker.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = await getPushPublicKey();
        if (!publicKey) return;

        subscription = await readyWorker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (subscription) {
        await syncPushSubscription(subscription);
      }
    } catch (error) {
      console.warn('Nao foi possivel registrar push no navegador:', error);
    }
  }, [getPushPublicKey, syncPushSubscription]);

  const unregisterPushSubscription = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
      const registeredWorker =
        serviceWorkerRegistrationRef.current || (await navigator.serviceWorker.getRegistration());
      if (!registeredWorker) return;

      const subscription = await registeredWorker.pushManager.getSubscription();
      if (!subscription) return;

      try {
        const payload = subscription.toJSON() as BrowserPushSubscriptionPayload;
        if (payload?.endpoint) {
          await api.post('/notifications/push/unsubscribe', { endpoint: payload.endpoint });
        }
      } catch (error) {
        // Se o token já expirou, manter apenas a remoção local.
        console.warn('Nao foi possivel remover assinatura push no backend:', error);
      }

      await subscription.unsubscribe();
    } catch (error) {
      console.warn('Nao foi possivel limpar assinatura push local:', error);
    }
  }, []);

  /**
   * Reproduz som de notificação
   */
  const playNotificationSound = useCallback(() => {
    initAudio();

    try {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(error => {
        console.warn('Não foi possível reproduzir som de notificação:', error);
      });
    } catch (error) {
      console.warn('Erro ao tentar reproduzir som:', error);
    }
  }, [initAudio]);

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
    const handleNewNotification = (notification: AppNotification) => {
      if (!isActiveRef.current) return;

      setNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev.slice(0, 9)];
      });

      setUnreadCount(prev => prev + 1);
      playNotificationSound();
      showBrowserNotification(notification);
    };

    // Listener para notificação lida
    const handleNotificationRead = (notification: AppNotification) => {
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
    const handleAllRead = (_data: { count: number }) => {
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

    const handleConnectError = (error: unknown) => {
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
  }, [playNotificationSound, showBrowserNotification]);

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
        socketClient.connect(token);
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
      void unregisterPushSubscription();
      setNotifications([]);
      setUnreadCount(0);
      setIsConnected(false);
      setConnectionError(null);
    }
  }, [user, token, setupSocketListeners, unregisterPushSubscription]);

  /**
   * Inicializa audio e solicita permissao de notificacao apos a primeira interacao.
   */
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;

    initAudio();

    if ('Notification' in window && window.Notification.permission === 'granted') {
      void registerPushSubscription();
      return;
    }

    const handleFirstInteraction = () => {
      void (async () => {
        const permission = await requestBrowserNotificationPermission();
        if (permission === 'granted') {
          await registerPushSubscription();
        }
      })();
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [user, initAudio, requestBrowserNotificationPermission, registerPushSubscription]);

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
