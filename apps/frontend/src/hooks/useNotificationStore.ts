/**
 * USE NOTIFICATION STORE - Store centralizada para notificações
 */

import { create } from 'zustand';
import { Notification } from '@/types/notifications';

interface NotificationStore {
  // Estado
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  connectionError: string | null;
  
  // Ações
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
  setUnreadCount: (count: number) => void;
  setConnectionStatus: (connected: boolean, error?: string | null) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, _get) => ({
  // Estado inicial
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  connectionError: null,

  // Ações
  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications.slice(0, 9)], // Mantém apenas 10
    unreadCount: state.unreadCount + 1
  })),

  updateNotification: (id, updates) => set((state) => ({
    notifications: state.notifications.map(n => 
      n.id === id ? { ...n, ...updates } : n
    )
  })),

  removeNotification: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    const wasUnread = notification && !notification.read;
    
    return {
      notifications: state.notifications.filter(n => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
    };
  }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  setConnectionStatus: (connected, error = null) => set({ 
    isConnected: connected, 
    connectionError: error 
  }),

  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    const wasUnread = notification && !notification.read;
    
    return {
      notifications: state.notifications.map(n => 
        n.id === id 
          ? { ...n, read: true, readAt: new Date() }
          : n
      ),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
    };
  }),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ 
      ...n, 
      read: true, 
      readAt: new Date() 
    })),
    unreadCount: 0
  })),

  clearAll: () => set({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    connectionError: null
  })
}));