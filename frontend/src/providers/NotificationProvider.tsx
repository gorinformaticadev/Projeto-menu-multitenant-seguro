/**
 * NOTIFICATION PROVIDER - Provider Socket.IO para notificações
 */

'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  isConnected: boolean;
  connectionError: string | null;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  playNotificationSound: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  connectionError: null,
  markAsRead: () => {},
  markAllAsRead: () => {},
  deleteNotification: () => {},
  playNotificationSound: () => {}
});

export const useNotificationContext = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const notificationHook = useNotifications();

  // Log de debug
  useEffect(() => {
    if (user) {
      console.log('🔔 NotificationProvider ativo para usuário:', user.id);
    }
  }, [user]);

  const value: NotificationContextType = {
    notifications: notificationHook.notifications,
    unreadCount: notificationHook.unreadCount,
    isConnected: notificationHook.isConnected,
    connectionError: notificationHook.connectionError,
    markAsRead: notificationHook.markAsRead,
    markAllAsRead: notificationHook.markAllAsRead,
    deleteNotification: notificationHook.deleteNotification,
    playNotificationSound: notificationHook.playNotificationSound,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}