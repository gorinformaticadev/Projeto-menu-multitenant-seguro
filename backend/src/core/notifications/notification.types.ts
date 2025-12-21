/**
 * NOTIFICATION TYPES - Tipos do sistema de notificações
 * 
 * Define contratos únicos para todas as notificações
 */

export interface NotificationPayload {
  tenantId?: string | null;
  userId?: string | null;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  origin: 'system' | 'modules' | 'orders';
  permissions: {
    canRead: boolean;
    canDelete: boolean;
  };
  metadata: {
    module: string;
    entityId?: string;
    legacy?: boolean; // quando vier de notificações antigas
    [key: string]: any;
  };
}

export interface NotificationRecord {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  origin: 'system' | 'modules' | 'orders';
  permissions: {
    canRead: boolean;
    canDelete: boolean;
  };
  metadata: {
    module: string;
    entityId?: string;
    legacy?: boolean;
    [key: string]: any;
  };
  read: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationFilters {
  tenantId?: string;
  userId?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'all';
  origin?: 'system' | 'modules' | 'orders' | 'all';
  module?: string;
  read?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationPermissions {
  canRead: boolean;
  canDelete: boolean;
  canMarkAsRead: boolean;
}

// Eventos de notificação em tempo real
export interface NotificationRealtimeEvent {
  type: 'notification_created' | 'notification_read' | 'notification_deleted';
  notification: NotificationRecord;
  tenantId?: string | null;
  userId?: string | null;
}