/**
 * NOTIFICATION STORE - Persistência de notificações
 * 
 * Gerencia histórico e armazenamento no banco de dados
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { NotificationPayload, NotificationRecord, NotificationFilters, NotificationListResponse } from './notification.types';
import { NotificationPermissionsService, UserContext } from './notification.permissions';

@Injectable()
export class NotificationStore {
  private readonly logger = new Logger(NotificationStore.name);

  constructor(
    private prisma: PrismaService,
    private permissions: NotificationPermissionsService
  ) {}

  /**
   * Persiste notificação no banco (NUNCA bloqueia tempo real)
   */
  async persistAsync(payload: NotificationPayload): Promise<void> {
    // Executa em background sem bloquear
    setImmediate(async () => {
      try {
        await this.persist(payload);
      } catch (error) {
        this.logger.error('Erro ao persistir notificação:', error);
      }
    });
  }

  /**
   * Persiste notificação no banco
   */
  async persist(payload: NotificationPayload): Promise<NotificationRecord> {
    const audiences = this.permissions.determineAudience(payload);
    const records: NotificationRecord[] = [];

    // Cria uma notificação para cada audiência
    for (const audience of audiences) {
      const record = await this.prisma.notification.create({
        data: {
          title: payload.title,
          message: payload.description,
          severity: payload.type,
          audience: this.mapAudience(audience),
          source: payload.origin === 'system' ? 'core' : 'module',
          module: payload.metadata.module,
          tenantId: audience.tenantId,
          userId: audience.userId,
          context: payload.metadata.entityId,
          data: JSON.stringify({
            permissions: payload.permissions,
            metadata: payload.metadata
          }),
          read: false
        }
      });

      records.push(this.mapToNotificationRecord(record));
    }

    this.logger.log(`Notificação persistida para ${records.length} audiência(s): ${payload.title}`);
    return records[0]; // Retorna a primeira para compatibilidade
  }

  /**
   * Busca notificações com filtros e permissões
   */
  async findMany(user: UserContext, filters: NotificationFilters = {}): Promise<NotificationListResponse> {
    const where = {
      ...this.permissions.buildDatabaseFilter(user),
      ...this.buildFilters(filters)
    };

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.notification.count({ where })
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...where,
        read: false
      }
    });

    return {
      notifications: notifications.map(this.mapToNotificationRecord),
      total,
      unreadCount,
      hasMore: total > skip + notifications.length
    };
  }

  /**
   * Busca notificações para dropdown (últimas 15)
   */
  async findForDropdown(user: UserContext): Promise<NotificationListResponse> {
    const where = this.permissions.buildDatabaseFilter(user);

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 15
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...where,
        read: false
      }
    });

    return {
      notifications: notifications.map(this.mapToNotificationRecord),
      total: notifications.length,
      unreadCount,
      hasMore: false
    };
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: string, user: UserContext): Promise<NotificationRecord | null> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        ...this.permissions.buildDatabaseFilter(user)
      }
    });

    if (!notification) {
      return null;
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return this.mapToNotificationRecord(updated);
  }

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(user: UserContext, filters?: NotificationFilters): Promise<number> {
    const where = {
      ...this.permissions.buildDatabaseFilter(user),
      ...this.buildFilters(filters || {}),
      read: false
    };

    const result = await this.prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Deleta notificação
   */
  async delete(notificationId: string, user: UserContext): Promise<NotificationRecord | null> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        ...this.permissions.buildDatabaseFilter(user)
      }
    });

    if (!notification) {
      return null;
    }

    // Verifica permissão de deletar
    const record = this.mapToNotificationRecord(notification);
    const permissions = this.permissions.getPermissions(user, record);
    
    if (!permissions.canDelete) {
      return null;
    }

    const deleted = await this.prisma.notification.delete({
      where: { id: notificationId }
    });

    return this.mapToNotificationRecord(deleted);
  }

  /**
   * Deleta múltiplas notificações
   */
  async deleteMany(notificationIds: string[], user: UserContext): Promise<number> {
    const where = {
      id: { in: notificationIds },
      ...this.permissions.buildDatabaseFilter(user)
    };

    const result = await this.prisma.notification.deleteMany({ where });
    return result.count;
  }

  /**
   * Conta notificações não lidas
   */
  async countUnread(user: UserContext): Promise<number> {
    const where = {
      ...this.permissions.buildDatabaseFilter(user),
      read: false
    };

    return this.prisma.notification.count({ where });
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private buildFilters(filters: NotificationFilters): any {
    const where: any = {};

    if (filters.type && filters.type !== 'all') {
      where.severity = filters.type;
    }

    if (filters.origin && filters.origin !== 'all') {
      where.source = filters.origin === 'system' ? 'core' : 'module';
    }

    if (filters.module) {
      where.module = filters.module;
    }

    if (filters.read !== undefined) {
      where.read = filters.read;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    return where;
  }

  private mapAudience(audience: { tenantId?: string | null; userId?: string | null }): string {
    if (audience.userId) return 'user';
    if (audience.tenantId) return 'admin';
    return 'super_admin';
  }

  private mapToNotificationRecord(dbRecord: any): NotificationRecord {
    const data = dbRecord.data ? JSON.parse(dbRecord.data) : {};
    
    return {
      id: dbRecord.id,
      tenantId: dbRecord.tenantId,
      userId: dbRecord.userId,
      title: dbRecord.title,
      description: dbRecord.message,
      type: dbRecord.severity,
      origin: dbRecord.source === 'core' ? 'system' : 'modules',
      permissions: data.permissions || { canRead: true, canDelete: true },
      metadata: data.metadata || { module: dbRecord.module || 'system' },
      read: dbRecord.read,
      readAt: dbRecord.readAt,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt
    };
  }
}