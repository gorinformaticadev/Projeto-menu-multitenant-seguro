/**
 * NOTIFICATION PROVIDER - Integração SSE + Frontend
 * 
 * Provider que escuta SSE e alimenta ícone + página de notificações
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextType {
  isConnected: boolean;
  connectionError: string | null;
  lastNotification: any | null;
  playNotificationSound: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  isConnected: false,
  connectionError: null,
  lastNotification: null,
  playNotificationSound: () => {}
});

export const useNotificationSSE = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<any | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Função para reproduzir som de notificação
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.warn('Não foi possível reproduzir som de notificação:', error);
      });
    } catch (error) {
      console.warn('Erro ao tentar reproduzir som:', error);
    }
  };

  // Conecta ao SSE
  const connectSSE = () => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Fecha conexão existente
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      console.log('🔌 Conectando ao SSE de notificações...');
      
      const eventSource = new EventSource('/api/notifications/sse', {
        withCredentials: true
      });

      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ Conexão SSE estabelecida');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Evento SSE recebido:', data);
          
          // Atualiza último evento
          setLastNotification(data);
          
          // Reproduz som para notificações novas
          if (data.type === 'notification' && data.data?.type === 'notification_created') {
            playNotificationSound();
          }
        } catch (error) {
          console.error('Erro ao processar evento SSE:', error);
        }
      };

      // Eventos específicos
      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔔 Nova notificação via SSE:', data);
          
          setLastNotification(data);
          playNotificationSound();
          
          // Dispara evento customizado para componentes escutarem
          window.dispatchEvent(new CustomEvent('newNotification', { detail: data }));
        } catch (error) {
          console.error('Erro ao processar notificação SSE:', error);
        }
      });

      eventSource.addEventListener('notification_read', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('👁️ Notificação lida via SSE:', data);
          
          // Dispara evento customizado
          window.dispatchEvent(new CustomEvent('notificationRead', { detail: data }));
        } catch (error) {
          console.error('Erro ao processar leitura SSE:', error);
        }
      });

      eventSource.addEventListener('notification_deleted', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🗑️ Notificação deletada via SSE:', data);
          
          // Dispara evento customizado
          window.dispatchEvent(new CustomEvent('notificationDeleted', { detail: data }));
        } catch (error) {
          console.error('Erro ao processar exclusão SSE:', error);
        }
      });

      eventSource.addEventListener('connected', (event) => {
        console.log('🎯 Confirmação de conexão SSE:', event.data);
      });

      eventSource.addEventListener('ping', (event) => {
        // Ping silencioso para manter conexão viva
      });

      eventSource.onerror = (error) => {
        console.error('❌ Erro na conexão SSE:', error);
        setIsConnected(false);
        
        if (eventSource.readyState === EventSource.CLOSED) {
          setConnectionError('Conexão SSE perdida');
          scheduleReconnect();
        }
      };

    } catch (error) {
      console.error('Erro ao criar conexão SSE:', error);
      setConnectionError('Falha ao conectar SSE');
      scheduleReconnect();
    }
  };

  // Agenda reconexão
  const scheduleReconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Máximo de tentativas de reconexão atingido');
      setConnectionError('Falha permanente na conexão SSE');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Backoff exponencial
    reconnectAttempts.current++;

    console.log(`🔄 Reagendando conexão SSE em ${delay}ms (tentativa ${reconnectAttempts.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connectSSE();
    }, delay);
  };

  // Desconecta SSE
  const disconnectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  };

  // Efeito para gerenciar conexão
  useEffect(() => {
    if (isAuthenticated && user) {
      connectSSE();
    } else {
      disconnectSSE();
    }

    return () => {
      disconnectSSE();
    };
  }, [isAuthenticated, user]);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      disconnectSSE();
    };
  }, []);

  const value: NotificationContextType = {
    isConnected,
    connectionError,
    lastNotification,
    playNotificationSound
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}