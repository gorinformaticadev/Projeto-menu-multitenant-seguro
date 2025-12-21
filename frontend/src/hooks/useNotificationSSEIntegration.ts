/**
 * NOTIFICATION SSE INTEGRATION - Hook para integrar SSE com componentes existentes
 * 
 * Integra eventos SSE com ícone e página de notificações sem alterar layout
 */

import { useEffect, useCallback } from 'react';
import { useNotificationSSE } from '@/providers/NotificationProvider';

interface SSEIntegrationOptions {
  onNewNotification?: (notification: any) => void;
  onNotificationRead?: (notification: any) => void;
  onNotificationDeleted?: (notification: any) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

export function useNotificationSSEIntegration(options: SSEIntegrationOptions = {}) {
  const { isConnected, connectionError, lastNotification, playNotificationSound } = useNotificationSSE();

  // Handler para nova notificação
  const handleNewNotification = useCallback((event: CustomEvent) => {
    const notification = event.detail;
    
    if (options.onNewNotification) {
      options.onNewNotification(notification);
    }
    
    // Log para debug
    console.log('🔔 Nova notificação integrada:', notification);
  }, [options.onNewNotification]);

  // Handler para notificação lida
  const handleNotificationRead = useCallback((event: CustomEvent) => {
    const notification = event.detail;
    
    if (options.onNotificationRead) {
      options.onNotificationRead(notification);
    }
    
    console.log('👁️ Notificação lida integrada:', notification);
  }, [options.onNotificationRead]);

  // Handler para notificação deletada
  const handleNotificationDeleted = useCallback((event: CustomEvent) => {
    const notification = event.detail;
    
    if (options.onNotificationDeleted) {
      options.onNotificationDeleted(notification);
    }
    
    console.log('🗑️ Notificação deletada integrada:', notification);
  }, [options.onNotificationDeleted]);

  // Registra listeners de eventos customizados
  useEffect(() => {
    window.addEventListener('newNotification', handleNewNotification as EventListener);
    window.addEventListener('notificationRead', handleNotificationRead as EventListener);
    window.addEventListener('notificationDeleted', handleNotificationDeleted as EventListener);

    return () => {
      window.removeEventListener('newNotification', handleNewNotification as EventListener);
      window.removeEventListener('notificationRead', handleNotificationRead as EventListener);
      window.removeEventListener('notificationDeleted', handleNotificationDeleted as EventListener);
    };
  }, [handleNewNotification, handleNotificationRead, handleNotificationDeleted]);

  // Notifica mudanças de conexão
  useEffect(() => {
    if (options.onConnectionChange) {
      options.onConnectionChange(isConnected);
    }
  }, [isConnected, options.onConnectionChange]);

  return {
    isConnected,
    connectionError,
    lastNotification,
    playNotificationSound,
    
    // Métodos de conveniência
    forceReconnect: () => {
      // Força reconexão recarregando a página (método simples)
      window.location.reload();
    },
    
    // Status da conexão para debug
    getConnectionStatus: () => ({
      isConnected,
      error: connectionError,
      lastNotification: lastNotification?.timestamp || null
    })
  };
}