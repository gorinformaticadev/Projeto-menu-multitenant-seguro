/**
 * NOTIFICATION TYPES - Tipos para o novo sistema Socket.IO
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
  metadata?: Record<string, unknown>;
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

export interface CreateNotificationData {
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  tenantId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationGroup {
  id: string;
  tenantId: string | null;
  userId: string | null;
  scopeType: string;
  scopeKey: string;
  unreadCount: number;
  totalCount: number;
  lastNotificationAt: string;
  lastTitle: string;
  lastBody: string | null;
}

export interface NotificationGroupListResponse {
  groups: NotificationGroup[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NotificationGroupItemsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}