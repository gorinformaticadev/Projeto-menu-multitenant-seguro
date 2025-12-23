/**
 * NOTIFICATION ENTITY - Entidade de notificação
 */

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  tenantId?: string | null;
  userId?: string | null;
  read: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface NotificationCreateData {
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  tenantId?: string | null;
  userId?: string | null;
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  type?: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
  tenantId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
}