import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { User } from '@prisma/client';
import { NotificationCore } from '@core/notifications/notification.core';
import { NotificationStore } from '@core/notifications/notification.store';

export interface NotificationEvent {
  type: string;
  source: 'core' | 'module';
  module?: string;
  severity: 'info' | 'warning' | 'critical';
  tenantId?: string | null;
  userId?: string | null;
  payload: {
    title: string;
    message: string;
    context?: string;
    data?: Record<string, any>;
  };
}

export interface NotificationFilters {
  severity?: 'info' | 'warning' | 'critical' | 'all';
  source?: 'core' | 'module' | 'all';
  module?: string;
  tenantId?: string;
  read?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private notificationCore: NotificationCore,
    private notificationStore: NotificationStore
  ) {}

  /**
   * Emite um evento e cria notificações baseado nas regras de audiência
   * AGORA USA O NOTIFICATION CORE
   */
  async emitEvent(event: NotificationEvent, emitterUser?: User): Promise<void> {
    console.log('🔔 Emitindo evento de notificação via Notification Core:', event.type);

    // Converte evento antigo para novo formato
    await this.notificationCore.notifyLegacy({
      tenantId: event.tenantId,
      userId: event.userId,
      title: event.payload.title,
      description: event.payload.message,
      severity: event.severity,
      source: event.source,
      module: event.module,
      context: event.payload.context,
      data: event.payload.data
    });

    console.log(`✅ Evento ${event.type} processado via Notification Core`);
  }

  /**
   * Busca notificações para o dropdown (Últimas 15)
   * AGORA USA O NOTIFICATION STORE
   */
  async getDropdownNotifications(user: User) {
    const response = await this.notificationStore.findForDropdown(user);
    
    return {
      notifications: response.notifications.map(this.formatNotificationLegacy),
      total: response.total,
      unreadCount: response.unreadCount,
      hasMore: response.hasMore,
    };
  }

  /**
   * Busca notificações para a central (paginadas e filtradas)
   * AGORA USA O NOTIFICATION STORE
   */
  async getCenterNotifications(user: User, filters: NotificationFilters = {}) {
    // Converte filtros antigos para novos
    const newFilters = {
      type: filters.severity && filters.severity !== 'all' ? 
        (filters.severity === 'critical' ? 'error' as const : filters.severity as any) : undefined,
      origin: filters.source && filters.source !== 'all' ? 
        (filters.source === 'core' ? 'system' as const : 'modules' as const) : undefined,
      module: filters.module,
      tenantId: filters.tenantId,
      read: filters.read,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      limit: filters.limit,
    };

    const response = await this.notificationStore.findMany(user, newFilters);

    return {
      notifications: response.notifications.map(this.formatNotificationLegacy),
      total: response.total,
      unreadCount: response.unreadCount,
      hasMore: response.hasMore,
    };
  }

  /**
   * Marca notificação como lida
   * AGORA USA O NOTIFICATION STORE
   */
  async markAsRead(notificationId: string, user: User): Promise<void> {
    const notification = await this.notificationStore.markAsRead(notificationId, user);
    
    if (!notification) {
      throw new ForbiddenException('Notificação não encontrada ou sem permissão');
    }
  }

  /**
   * Marca todas as notificações como lidas
   * AGORA USA O NOTIFICATION STORE
   */
  async markAllAsRead(user: User, filters?: Partial<NotificationFilters>): Promise<void> {
    // Converte filtros se fornecidos
    const newFilters = filters ? {
      type: filters.severity && filters.severity !== 'all' ? 
        (filters.severity === 'critical' ? 'error' as const : filters.severity as any) : undefined,
      origin: filters.source && filters.source !== 'all' ? 
        (filters.source === 'core' ? 'system' as const : 'modules' as const) : undefined,
      module: filters.module,
      tenantId: filters.tenantId,
      read: filters.read,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    } : undefined;

    await this.notificationStore.markAllAsRead(user, newFilters);
  }

  /**
   * Deleta notificação
   * AGORA USA O NOTIFICATION STORE
   */
  async deleteNotification(notificationId: string, user: User): Promise<void> {
    const notification = await this.notificationStore.delete(notificationId, user);
    
    if (!notification) {
      throw new ForbiddenException('Notificação não encontrada ou sem permissão');
    }
  }

  /**
   * Deleta múltiplas notificações
   * AGORA USA O NOTIFICATION STORE
   */
  async deleteNotifications(notificationIds: string[], user: User): Promise<void> {
    await this.notificationStore.deleteMany(notificationIds, user);
  }

  /**
   * Busca contagem de não lidas
   * AGORA USA O NOTIFICATION STORE
   */
  async getUnreadCount(user: User): Promise<number> {
    return this.notificationStore.countUnread(user);
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private formatNotificationLegacy(notification: any) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.description,
      severity: notification.type === 'error' ? 'critical' : notification.type,
      audience: this.mapAudienceLegacy(notification),
      source: notification.origin === 'system' ? 'core' : 'module',
      module: notification.metadata.module,
      tenantId: notification.tenantId,
      userId: notification.userId,
      context: notification.metadata.entityId,
      data: notification.metadata,
      read: notification.read,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }

  private mapAudienceLegacy(notification: any): string {
    if (notification.userId) return 'user';
    if (notification.tenantId) return 'admin';
    return 'super_admin';
  }
}