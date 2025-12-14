import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

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
  constructor(private prisma: PrismaService) {}

  /**
   * Emite um evento e cria notificações baseado nas regras de audiência
   */
  async emitEvent(event: NotificationEvent, emitterUser?: User): Promise<void> {
    console.log('📢 Emitindo evento de notificação:', event.type);

    // Validações básicas
    this.validateEvent(event);

    // Determina audiência baseado na severidade e contexto
    const audiences = this.determineAudiences(event, emitterUser);

    // Cria notificações para cada audiência
    for (const audience of audiences) {
      await this.createNotification(event, audience);
    }

    console.log(`✅ Evento ${event.type} processado para ${audiences.length} audiência(s)`);
  }

  /**
   * Busca notificações para o dropdown (últimas 15)
   */
  async getDropdownNotifications(user: User) {
    const notifications = await this.prisma.notification.findMany({
      where: this.buildUserFilter(user),
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...this.buildUserFilter(user),
        read: false,
      },
    });

    return {
      notifications: notifications.map(this.formatNotification),
      total: notifications.length,
      unreadCount,
      hasMore: false, // Para dropdown sempre false
    };
  }

  /**
   * Busca notificações para a central (paginadas e filtradas)
   */
  async getCenterNotifications(user: User, filters: NotificationFilters = {}) {
    const where = {
      ...this.buildUserFilter(user),
      ...this.buildFilters(filters, user),
    };

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...where,
        read: false,
      },
    });

    return {
      notifications: notifications.map(this.formatNotification),
      total,
      unreadCount,
      hasMore: total > skip + notifications.length,
    };
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: string, user: User): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        ...this.buildUserFilter(user),
      },
    });

    if (!notification) {
      throw new ForbiddenException('Notificação não encontrada ou sem permissão');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(user: User, filters?: Partial<NotificationFilters>): Promise<void> {
    const where = {
      ...this.buildUserFilter(user),
      ...this.buildFilters(filters || {}, user),
      read: false,
    };

    await this.prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Deleta notificação
   */
  async deleteNotification(notificationId: string, user: User): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        ...this.buildUserFilter(user),
      },
    });

    if (!notification) {
      throw new ForbiddenException('Notificação não encontrada ou sem permissão');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Deleta múltiplas notificações
   */
  async deleteNotifications(notificationIds: string[], user: User): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        ...this.buildUserFilter(user),
      },
    });
  }

  /**
   * Busca contagem de não lidas
   */
  async getUnreadCount(user: User): Promise<number> {
    return this.prisma.notification.count({
      where: {
        ...this.buildUserFilter(user),
        read: false,
      },
    });
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private validateEvent(event: NotificationEvent): void {
    if (!event.type || !event.payload?.title || !event.payload?.message) {
      throw new BadRequestException('Evento inválido: type, title e message são obrigatórios');
    }

    if (event.payload.title.length > 100) {
      throw new BadRequestException('Título não pode ter mais de 100 caracteres');
    }

    if (event.payload.message.length > 500) {
      throw new BadRequestException('Mensagem não pode ter mais de 500 caracteres');
    }
  }

  private determineAudiences(event: NotificationEvent, emitterUser?: User): Array<{
    audience: 'user' | 'admin' | 'super_admin';
    tenantId?: string | null;
    userId?: string | null;
  }> {
    const audiences = [];

    // Se tem userId específico, é para o usuário
    if (event.userId) {
      audiences.push({
        audience: 'user' as const,
        tenantId: event.tenantId,
        userId: event.userId,
      });
    }
    // Se tem tenantId mas não userId, é para admins do tenant
    else if (event.tenantId) {
      audiences.push({
        audience: 'admin' as const,
        tenantId: event.tenantId,
        userId: null,
      });
    }
    // Se não tem nem userId nem tenantId, é global (super_admin)
    else {
      audiences.push({
        audience: 'super_admin' as const,
        tenantId: null,
        userId: null,
      });
    }

    // Notificações críticas sempre vão para super_admin também
    if (event.severity === 'critical') {
      audiences.push({
        audience: 'super_admin' as const,
        tenantId: null,
        userId: null,
      });
    }

    return audiences;
  }

  private async createNotification(
    event: NotificationEvent,
    audience: {
      audience: 'user' | 'admin' | 'super_admin';
      tenantId?: string | null;
      userId?: string | null;
    }
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        title: event.payload.title,
        message: event.payload.message,
        severity: event.severity,
        audience: audience.audience,
        source: event.source,
        module: event.module,
        tenantId: audience.tenantId,
        userId: audience.userId,
        context: event.payload.context,
        data: JSON.stringify(event.payload.data || {}),
        read: false,
      },
    });
  }

  private buildUserFilter(user: User) {
    const baseFilter: any = {};

    if (user.role === 'USER') {
      // Usuário comum: apenas suas próprias notificações não críticas
      baseFilter.AND = [
        { userId: user.id },
        { severity: { not: 'critical' } },
      ];
    } else if (user.role === 'ADMIN') {
      // Admin: notificações do tenant (suas próprias + do tenant)
      baseFilter.OR = [
        { userId: user.id },
        {
          AND: [
            { tenantId: user.tenantId },
            { audience: { in: ['admin', 'user'] } },
          ],
        },
      ];
    } else if (user.role === 'SUPER_ADMIN') {
      // Super Admin: todas as notificações
      // Sem filtro adicional
    }

    return baseFilter;
  }

  private buildFilters(filters: NotificationFilters, user: User) {
    const where: any = {};

    if (filters.severity && filters.severity !== 'all') {
      where.severity = filters.severity;
    }

    if (filters.source && filters.source !== 'all') {
      where.source = filters.source;
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

    // Super admin pode filtrar por tenant
    if (filters.tenantId && user.role === 'SUPER_ADMIN') {
      where.tenantId = filters.tenantId;
    }

    return where;
  }

  private formatNotification(notification: any) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      audience: notification.audience,
      source: notification.source,
      module: notification.module,
      tenantId: notification.tenantId,
      userId: notification.userId,
      context: notification.context,
      data: notification.data ? JSON.parse(notification.data) : {},
      read: notification.read,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }
}