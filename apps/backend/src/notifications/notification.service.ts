/**
 * NOTIFICATION SERVICE - Lógica de negócio e persistência
 */

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  Notification,
  NotificationCreateData,
  NotificationFilters,
  NotificationResponse
} from './notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Cria uma nova notificação
   */
  async create(data: NotificationCreateData): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          title: data.title,
          message: data.description, // Prisma usa 'message', nossa interface usa 'description'
          severity: data.type, // Prisma usa 'severity', nossa interface usa 'type'
          audience: this.determineAudience(data.tenantId, data.userId),
          source: 'core',
          tenantId: data.tenantId,
          userId: data.userId,
          data: JSON.stringify(data.metadata || {}),
          read: false,
        },
      });

      this.logger.log(`Notificação criada: ${notification.id} - ${notification.title}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.error('Erro ao criar notificação:', error);
      throw error;
    }
  }

  /**
   * Busca notificações para o dropdown (últimas 10)
   */
  async findForDropdown(user: any): Promise<NotificationResponse> {
    const where = this.buildWhereClause(user);

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, read: false }
      }),
    ]);

    return {
      notifications: notifications.map(n => this.mapToEntity(n)),
      total,
      unreadCount,
      hasMore: total > 10,
    };
  }

  /**
   * Busca notificações com filtros e paginação
   */
  async findMany(user: any, filters: NotificationFilters = {}): Promise<NotificationResponse> {
    const where = this.buildWhereClause(user, filters);
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, read: false }
      }),
    ]);

    return {
      notifications: notifications.map(n => this.mapToEntity(n)),
      total,
      unreadCount,
      hasMore: skip + notifications.length < total,
    };
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(id: string, user: any): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user)
    };

    try {
      const notification = await this.prisma.notification.update({
        where,
        data: {
          read: true,
          readAt: new Date()
        },
      });

      this.logger.log(`Notificação marcada como lida: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`Notificação não encontrada ou sem permissão: ${id}`);
      return null;
    }
  }

  /**
   * Marca notificação como NÃO lida
   */
  async markAsUnread(id: string, user: any): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user)
    };

    try {
      const notification = await this.prisma.notification.update({
        where,
        data: {
          read: false,
          readAt: null
        },
      });

      this.logger.log(`Notificação marcada como não lida: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`Notificação não encontrada ou sem permissão: ${id}`);
      return null;
    }
  }

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(user: any, filters?: NotificationFilters): Promise<number> {
    const where = this.buildWhereClause(user, filters);

    const result = await this.prisma.notification.updateMany({
      where: { ...where, read: false },
      data: {
        read: true,
        readAt: new Date()
      },
    });

    this.logger.log(`${result.count} notificações marcadas como lidas`);
    return result.count;
  }

  /**
   * Deleta uma notificação
   */
  async delete(id: string, user: any): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user)
    };

    try {
      const notification = await this.prisma.notification.delete({
        where,
      });

      this.logger.log(`Notificação deletada: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`Notificação não encontrada ou sem permissão: ${id}`);
      return null;
    }
  }

  /**
   * Deleta múltiplas notificações
   */
  async deleteMany(ids: string[], user: any): Promise<number> {
    const where = {
      id: { in: ids },
      ...this.buildWhereClause(user)
    };

    const result = await this.prisma.notification.deleteMany({
      where,
    });

    this.logger.log(`${result.count} notificações deletadas`);
    return result.count;
  }

  /**
   * Conta notificações não lidas
   */
  async countUnread(user: any): Promise<number> {
    const where = {
      ...this.buildWhereClause(user),
      read: false
    };

    return this.prisma.notification.count({ where });
  }

  /**
   * Busca uma notificação por ID
   */
  async findById(id: string, user: any): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user)
    };

    try {
      const notification = await this.prisma.notification.findUnique({
        where,
      });

      return notification ? this.mapToEntity(notification) : null;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private buildWhereClause(user: any, filters?: NotificationFilters) {
    const where: any = {};

    // Filtros de permissão baseados no papel do usuário
    if (user.role === 'USER') {
      // Usuário comum: apenas suas próprias notificações
      where.userId = user.id;
    } else if (user.role === 'ADMIN') {
      // Admin: notificações do seu tenant
      where.OR = [
        { tenantId: user.tenantId, userId: null }, // Notificações do tenant
        { userId: user.id }, // Suas próprias notificações
      ];
    } else if (user.role === 'SUPER_ADMIN') {
      // Super Admin: todas as notificações (sem filtro adicional)
    }

    // Aplicar filtros adicionais
    if (filters) {
      if (filters.type) {
        // Mapear type para severity
        const severityMap = {
          'error': 'critical',
          'warning': 'warning',
          'info': 'info',
          'success': 'info'
        };
        where.severity = severityMap[filters.type] || 'info';
      }
      if (filters.read !== undefined) {
        where.read = filters.read;
      }
      if (filters.tenantId && user.role === 'SUPER_ADMIN') {
        where.tenantId = filters.tenantId;
      }
      if (filters.userId && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
        where.userId = filters.userId;
      }
      if (filters.dateFrom) {
        where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
      }
      if (filters.dateTo) {
        where.createdAt = { ...where.createdAt, lte: filters.dateTo };
      }
    }

    return where;
  }

  private mapToEntity(notification: any): Notification {
    return {
      id: notification.id,
      title: notification.title,
      description: notification.message, // Prisma usa 'message'
      type: this.mapSeverityToType(notification.severity), // Converte severity para type
      tenantId: notification.tenantId,
      userId: notification.userId,
      read: notification.read,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      metadata: this.parseMetadata(notification.data),
    };
  }

  private determineAudience(tenantId?: string | null, userId?: string | null): string {
    if (userId) return 'user';
    if (tenantId) return 'admin';
    return 'super_admin';
  }

  private mapSeverityToType(severity: string): 'info' | 'success' | 'warning' | 'error' {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }

  private parseMetadata(data: string): Record<string, any> {
    try {
      return JSON.parse(data || '{}');
    } catch {
      return {};
    }
  }
}