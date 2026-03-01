/**
 * NOTIFICATION SERVICE - LÃ³gica de negÃ³cio e persistÃªncia
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  Notification,
  NotificationCreateData,
  NotificationFilters,
  NotificationResponse
} from './notification.entity';
import { BroadcastNotificationDto } from './notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {
      // Empty implementation
    }

  /**
   * Cria uma nova notificaÃ§Ã£o
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

      this.logger.log(`NotificaÃ§Ã£o criada: ${notification.id} - ${notification.title}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.error('Erro ao criar notificaÃ§Ã£o:', error);
      throw error;
    }
  }

  /**
   * Busca notificaÃ§Ãµes para o dropdown (Ãºltimas 10)
   */
  async findForDropdown(user: unknown): Promise<NotificationResponse> {
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
   * Busca notificaÃ§Ãµes com filtros e paginaÃ§Ã£o
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
   * Marca notificaÃ§Ã£o como lida
   */
  async markAsRead(id: string, user: unknown): Promise<Notification | null> {
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

      this.logger.log(`NotificaÃ§Ã£o marcada como lida: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`NotificaÃ§Ã£o nÃ£o encontrada ou sem permissÃ£o: ${id}`);
      return null;
    }
  }

  /**
   * Marca notificaÃ§Ã£o como NÃƒO lida
   */
  async markAsUnread(id: string, user: unknown): Promise<Notification | null> {
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

      this.logger.log(`NotificaÃ§Ã£o marcada como nÃ£o lida: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`NotificaÃ§Ã£o nÃ£o encontrada ou sem permissÃ£o: ${id}`);
      return null;
    }
  }

  /**
   * Marca todas as notificaÃ§Ãµes como lidas
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

    this.logger.log(`${result.count} notificaÃ§Ãµes marcadas como lidas`);
    return result.count;
  }

  /**
   * Deleta uma notificaÃ§Ã£o
   */
  async delete(id: string, user: unknown): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user)
    };

    try {
      const notification = await this.prisma.notification.delete({
        where,
      });

      this.logger.log(`NotificaÃ§Ã£o deletada: ${id}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.warn(`NotificaÃ§Ã£o nÃ£o encontrada ou sem permissÃ£o: ${id}`);
      return null;
    }
  }

  /**
   * Deleta mÃºltiplas notificaÃ§Ãµes
   */
  async deleteMany(ids: string[], user: unknown): Promise<number> {
    const where = {
      id: { in: ids },
      ...this.buildWhereClause(user)
    };

    const result = await this.prisma.notification.deleteMany({
      where,
    });

    this.logger.log(`${result.count} notificaÃ§Ãµes deletadas`);
    return result.count;
  }

  /**
   * Conta notificaÃ§Ãµes nÃ£o lidas
   */
  async countUnread(user: unknown): Promise<number> {
    const where = {
      ...this.buildWhereClause(user),
      read: false
    };

    return this.prisma.notification.count({ where });
  }

  /**
   * Envia notificaÃ§Ã£o em massa (Broadcast)
   */
  async broadcast(dto: BroadcastNotificationDto, authorInfo: unknown): Promise<{ count: number }> {
    const where: any = {};

    // 1. Filtro de Target (Role)
    if (dto.target === 'admins_only') {
      where.role = { in: ['ADMIN', 'SUPER_ADMIN'] };
    } else if (dto.target === 'super_admins') {
      where.role = 'SUPER_ADMIN';
    }

    // 2. Filtro de Escopo (Tenants)
    if (dto.scope === 'tenants' && dto.tenantIds && dto.tenantIds.length > 0) {
      where.tenantId = { in: dto.tenantIds };
    }

    // Buscar UsuÃ¡rios Alvo
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, tenantId: true }
    });

    if (!users || users.length === 0) {
      return { count: 0 };
    }

    // 4. Mapear Severidade
    const severityMap = {
      'error': 'critical',
      'warning': 'warning',
      'success': 'info', // ou success se o banco suportar
      'info': 'info'
    };
    const dbSeverity = severityMap[dto.type] || 'info';

    // 5. Preparar dados para Bulk Insert
    const notificationsData = users.map(u => ({
      title: dto.title,
      message: dto.description,
      severity: dbSeverity,
      userId: u.id,
      tenantId: u.tenantId,
      source: 'broadcast',
      audience: 'user',
      read: false,
      data: JSON.stringify({ broadcast: true, target: dto.target }),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // 6. Inserir (createMany)
    const result = await this.prisma.notification.createMany({
      data: notificationsData
    });

    this.logger.log(`Broadcast enviado para ${result.count} usuÃ¡rios. Scope: ${dto.scope}`);

    return { count: result.count };
  }

  /**
   * Busca uma notificaÃ§Ã£o por ID
   */
  async findById(id: string, user: unknown): Promise<Notification | null> {
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
  // MÃ‰TODOS PRIVADOS
  // ============================================================================

  private buildWhereClause(user: any, filters?: NotificationFilters) {
    const where: any = {};

    // Filtros de permissÃ£o baseados no papel do usuÃ¡rio
    if (user.role === 'USER') {
      // UsuÃ¡rio comum: apenas suas prÃ³prias notificaÃ§Ãµes
      where.userId = user.id;
    } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Perfis administrativos:
      // - visualizam tudo da prÃ³pria tenant (incluindo notificaÃ§Ãµes de outros usuÃ¡rios da tenant)
      // - mantÃªm acesso Ã s prÃ³prias notificaÃ§Ãµes diretas
      if (user.tenantId) {
        where.OR = [
          { tenantId: user.tenantId },
          { userId: user.id },
        ];
      } else {
        // Fallback seguro para contas administrativas sem tenant vinculada
        where.OR = [
          { userId: user.id },
          { userId: null, tenantId: null },
        ];
      }
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
