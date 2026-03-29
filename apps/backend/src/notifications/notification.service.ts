/**
 * NOTIFICATION SERVICE - Logica de negocio e persistencia
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Notification as PrismaNotification, Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { ConfigResolverService } from '../system-settings/config-resolver.service';
import { Observable, Subject } from 'rxjs';
import {
  Notification,
  NotificationCreateData,
  NotificationFilters,
  NotificationResponse,
} from './notification.entity';
import { BroadcastNotificationDto, NotificationConfigurationStatusDto } from './notification.dto';
import { AuthorizationService } from '@common/services/authorization.service';

export type SystemNotificationSeverity = 'info' | 'warning' | 'critical';

export interface EmitSystemAlertInput {
  action: string;
  severity: SystemNotificationSeverity | string;
  title?: string;
  body?: string;
  message?: string;
  module?: string;
  data?: Record<string, unknown>;
  targetRole?: string | null;
  targetUserId?: string | null;
}

export interface CreateSystemNotificationInput {
  severity: SystemNotificationSeverity | string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  targetRole?: string | null;
  targetUserId?: string | null;
  type?: string;
  module?: string | null;
  source?: string | null;
  tenantId?: string | null;
  userId?: string | null;
}

export interface SystemNotificationListParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  unreadOnly?: boolean;
  severity?: SystemNotificationSeverity | string;
  targetRole?: string;
  targetUserId?: string;
}

export interface NotificationActorScope {
  userId?: string;
  role?: string;
  targetRole?: string;
  targetUserId?: string;
}

export interface SystemNotificationDto {
  id: string;
  type: string;
  severity: SystemNotificationSeverity;
  title: string;
  body: string;
  data: Record<string, unknown>;
  module: string | null;
  source: string | null;
  createdAt: Date;
  isRead: boolean;
  readAt: Date | null;
}

export interface NotificationsToggleState extends NotificationConfigurationStatusDto {}

interface NormalizedNotificationActor {
  id: string | null;
  role: string;
  tenantId: string | null;
}

const SYSTEM_ALERT_RULES: Record<string, { severity: SystemNotificationSeverity; title: string }> = {
  UPDATE_STARTED: {
    severity: 'warning',
    title: 'Atualizacao iniciada',
  },
  UPDATE_COMPLETED: {
    severity: 'warning',
    title: 'Atualizacao concluida',
  },
  UPDATE_FAILED: {
    severity: 'critical',
    title: 'Atualizacao falhou',
  },
  UPDATE_ROLLED_BACK_AUTO: {
    severity: 'critical',
    title: 'Rollback automatico executado',
  },
  UPDATE_ROLLBACK_MANUAL: {
    severity: 'critical',
    title: 'Rollback manual executado',
  },
  MAINTENANCE_ENABLED: {
    severity: 'warning',
    title: 'Modo manutencao ativado',
  },
  MAINTENANCE_BYPASS_USED: {
    severity: 'critical',
    title: 'Bypass de manutencao utilizado',
  },
  BACKUP_FAILED: {
    severity: 'warning',
    title: 'Backup falhou',
  },
  RESTORE_STARTED: {
    severity: 'critical',
    title: 'Restauracao iniciada',
  },
  RESTORE_COMPLETED: {
    severity: 'critical',
    title: 'Restauracao concluida',
  },
  RESTORE_FAILED: {
    severity: 'critical',
    title: 'Restauracao falhou',
  },
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly systemAlertsSubject = new Subject<SystemNotificationDto>();

  constructor(
    private prisma: PrismaService,
    private readonly configResolver: ConfigResolverService,
    private readonly authorizationService: AuthorizationService,
  ) {
    // Empty implementation
  }

  getSystemAlertStream(): Observable<SystemNotificationDto> {
    return this.systemAlertsSubject.asObservable();
  }

  async getNotificationsToggleState(): Promise<NotificationsToggleState> {
    const resolved = await this.configResolver.getResolved<boolean>('notifications.enabled');

    return {
      key: 'notifications.enabled',
      enabled: resolved?.value !== false,
      source: resolved?.source ?? 'default',
    };
  }

  async emitSystemAlert(input: EmitSystemAlertInput): Promise<SystemNotificationDto | null> {
    const action = this.normalizeAction(input.action);
    const actionRule = SYSTEM_ALERT_RULES[action];
    if (!actionRule) {
      return null;
    }

    const severity = actionRule.severity;
    const title = this.normalizeText(input.title || actionRule.title || this.buildSystemAlertTitle(action), 140);
    const body = this.normalizeText(input.body || input.message || title, 500);
    const targetRole = this.normalizeText(input.targetRole || 'SUPER_ADMIN', 40);
    const targetUserId = this.normalizeOptionalText(input.targetUserId || undefined, 80);
    const moduleName = this.normalizeText(input.module || 'system', 80);
    const payloadData = this.sanitizeData({
      action,
      module: moduleName,
      ...(input.data || {}),
    });

    return this.createSystemNotification({
      severity,
      title,
      body,
      data: payloadData,
      targetRole,
      targetUserId,
      type: 'SYSTEM_ALERT',
    });
  }

  async createSystemNotification(input: CreateSystemNotificationInput): Promise<SystemNotificationDto | null> {
    const row = await this.persistSystemNotification(input);
    if (!row) {
      return null;
    }

    const dto = this.toSystemNotificationDto(row);
    this.systemAlertsSubject.next(dto);
    return dto;
  }

  async createSystemNotificationEntity(input: CreateSystemNotificationInput): Promise<Notification | null> {
    const row = await this.persistSystemNotification(input);
    if (!row) {
      return null;
    }

    const dto = this.toSystemNotificationDto(row);
    this.systemAlertsSubject.next(dto);
    return this.mapToEntity(row);
  }

  private async persistSystemNotification(
    input: CreateSystemNotificationInput,
  ): Promise<PrismaNotification | null> {
    if (!(await this.areNotificationsEnabled())) {
      return null;
    }

    const severity = this.normalizeSeverity(input.severity);
    const title = this.normalizeText(input.title, 140);
    const body = this.normalizeText(input.body, 500);
    const targetRole = this.normalizeText(input.targetRole || 'SUPER_ADMIN', 40);
    const targetUserId = this.normalizeOptionalText(input.targetUserId || undefined, 80);
    const type = this.normalizeText(input.type || 'SYSTEM_ALERT', 40);
    const source = this.normalizeText(input.source || 'system', 40) || 'system';
    const moduleName = this.normalizeText(input.module || 'system', 80) || 'system';
    const tenantId = this.normalizeOptionalText(input.tenantId || undefined, 80);
    const userId = this.normalizeOptionalText(input.userId || targetUserId || undefined, 80);
    const data = this.sanitizeData(input.data || {});

    if (!title || !body) {
      return null;
    }

    try {
      const notification = await this.prisma.notification.create({
        data: {
          type,
          severity,
          title,
          body,
          message: body,
          data: this.toInputJson(data),
          targetRole,
          targetUserId,
          isRead: false,
          read: false,
          readAt: null,
          audience: targetUserId ? 'user' : tenantId ? 'admin' : 'super_admin',
          source,
          module: moduleName,
          tenantId,
          userId,
        },
      });

      try {
        await this.assignNotificationToGroup(notification, input.module);
      } catch (groupError) {
        this.logGroupWarning('persist_assign_failed', {
          notificationId: notification.id,
          tenantId: notification.tenantId,
          userId: notification.userId,
          error: groupError,
        });
      }

      return notification;
    } catch (error) {
      this.logger.error(`Falha ao persistir notificacao de sistema: ${String(error)}`);
      return null;
    }
  }

  async list(
    params: SystemNotificationListParams = {},
  ): Promise<{
    notifications: SystemNotificationDto[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = this.clampNumber(params.page, 1, 100000, 1);
    const limit = this.clampNumber(params.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const where = this.buildSystemListWhere(params);
    const unreadWhere = {
      ...where,
      isRead: false,
    };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: unreadWhere }),
    ]);

    return {
      notifications: rows.map((row) => this.toSystemNotificationDto(row)),
      total,
      unreadCount,
      page,
      limit,
      hasMore: skip + rows.length < total,
    };
  }

  async listSystemNotifications(params: SystemNotificationListParams = {}): Promise<{
    notifications: SystemNotificationDto[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return this.list(params);
  }

  async markAsRead(id: string, actor?: NotificationActorScope): Promise<SystemNotificationDto | null> {
    const notificationId = this.normalizeText(id, 80);
    const scope = this.resolveSystemScope(actor);
    if (!notificationId) {
      return null;
    }

    try {
      const existing = await this.prisma.notification.findFirst({
        where: { id: notificationId, ...scope },
        select: { read: true, isRead: true, notificationGroupId: true },
      });

      if (!existing) {
        return null;
      }

      const wasUnread = !existing.read && !existing.isRead;

      if (wasUnread && existing.notificationGroupId) {
        await this.markNotificationReadWithGroup(notificationId, existing.notificationGroupId);
      } else {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            read: true,
            isRead: true,
            readAt: new Date(),
          },
        });
      }

      const row = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!row || !this.isSystemNotificationRecord(row)) {
        return null;
      }

      return this.toSystemNotificationDto(row);
    } catch (error) {
      this.logger.error(`Falha ao marcar notificacao como lida id=${notificationId}: ${String(error)}`);
      return null;
    }
  }

  async markSystemNotificationAsRead(
    id: string,
    actor?: NotificationActorScope,
  ): Promise<SystemNotificationDto | null> {
    return this.markAsRead(id, actor);
  }

  async markAllSystemNotificationsAsRead(actor?: NotificationActorScope): Promise<number> {
    const scope = this.resolveSystemScope(actor);

    try {
      const unreadWhere = {
        ...scope,
        isRead: false,
      };

      const affectedGroupIds = await this.prisma.notification.findMany({
        where: unreadWhere,
        select: { notificationGroupId: true },
        distinct: ['notificationGroupId'],
      });

      const result = await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.notification.updateMany({
          where: unreadWhere,
          data: {
            read: true,
            isRead: true,
            readAt: new Date(),
          },
        });

        const groupIds = affectedGroupIds
          .map((n) => n.notificationGroupId)
          .filter((id): id is string => Boolean(id));

        for (const groupId of groupIds) {
          await this.syncGroupCounters(tx, groupId);
          this.logGroupOperation('markAllSystemRead', { groupId });
        }

        return updateResult;
      });

      return result.count;
    } catch (error) {
      this.logger.error(`Falha ao marcar notificacoes como lidas: ${String(error)}`);
      return 0;
    }
  }

  async getUnreadSystemNotificationsCount(scope?: {
    targetRole?: string;
    targetUserId?: string;
  }): Promise<number> {
    const where = this.buildSystemScopeWhere(scope);

    try {
      return await this.prisma.notification.count({
        where: {
          ...where,
          isRead: false,
        },
      });
    } catch (error) {
      this.logger.error(`Falha ao contar notificacoes nao lidas: ${String(error)}`);
      return 0;
    }
  }

  async getUnreadCount(scope?: { targetRole?: string; targetUserId?: string }): Promise<number> {
    return this.getUnreadSystemNotificationsCount(scope);
  }

  async findSystemNotificationEntityById(id: string): Promise<Notification | null> {
    const notificationId = this.normalizeText(id, 80);
    if (!notificationId) {
      return null;
    }

    try {
      const row = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!row || !this.isSystemNotificationRecord(row)) {
        return null;
      }

      return this.mapToEntity(row);
    } catch (error) {
      this.logger.error(`Falha ao buscar notificacao de sistema id=${notificationId}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Cria uma nova notificacao
   */
  async create(data: NotificationCreateData, authorInfo?: unknown): Promise<Notification | null> {
    if (!(await this.areNotificationsEnabled())) {
      return null;
    }

    try {
      const scopedData = await this.applyNotificationAuthorScope(data, authorInfo);
      const severity = this.mapTypeToSeverity(data.type);
      const notification = await this.prisma.notification.create({
        data: {
          type: 'SYSTEM_ALERT',
          title: scopedData.title,
          body: scopedData.description,
          message: scopedData.description,
          severity,
          audience: this.determineAudience(scopedData.tenantId, scopedData.userId),
          source: 'core',
          tenantId: scopedData.tenantId,
          userId: scopedData.userId,
          targetRole: scopedData.userId ? null : scopedData.tenantId ? 'ADMIN' : 'SUPER_ADMIN',
          targetUserId: scopedData.userId,
          data: this.toInputJson(this.sanitizeData(scopedData.metadata || {})),
          isRead: false,
          read: false,
        },
      });

      try {
        await this.assignNotificationToGroup(notification, null);
      } catch (groupError) {
        this.logGroupWarning('create_assign_failed', {
          notificationId: notification.id,
          tenantId: notification.tenantId,
          userId: notification.userId,
          error: groupError,
        });
      }

      this.logger.log(`Notificacao criada: ${notification.id} - ${notification.title}`);
      return this.mapToEntity(notification);
    } catch (error) {
      this.logger.error('Erro ao criar notificacao:', error);
      throw error;
    }
  }

  /**
   * Busca notificacoes para o dropdown (ultimas 10)
   */
  async findForDropdown(user: unknown): Promise<NotificationResponse> {
    const where = this.buildWhereClause(user);
    const unreadWhere = this.buildUnreadWhere(where);

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: unreadWhere }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapToEntity(n)),
      total,
      unreadCount,
      hasMore: total > 10,
    };
  }

  /**
   * Busca notificacoes com filtros e paginacao
   */
  async findMany(user: unknown, filters: NotificationFilters = {}): Promise<NotificationResponse> {
    const where = this.buildWhereClause(user, filters);
    const unreadWhere = this.buildUnreadWhere(where);
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
      this.prisma.notification.count({ where: unreadWhere }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapToEntity(n)),
      total,
      unreadCount,
      hasMore: skip + notifications.length < total,
    };
  }

  /**
   * Marca notificacao como lida
   */
  async markUserNotificationAsRead(id: string, user: unknown): Promise<Notification | null> {
    const actor = this.normalizeNotificationActor(user);
    const existing = await this.findAccessibleNotificationRow(id, actor, 'read');
    if (!existing) {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }

    const wasUnread = !existing.read && !existing.isRead;

    try {
      if (wasUnread) {
        await this.markNotificationReadWithGroup(id, existing.notificationGroupId);
      } else {
        await this.prisma.notification.update({
          where: { id: existing.id },
          data: {
            read: true,
            isRead: true,
            readAt: new Date(),
          },
        });
      }

      const row = await this.prisma.notification.findUnique({
        where: { id: existing.id },
      });

      this.logger.log(`Notificacao marcada como lida: ${id}`);
      return row ? this.mapToEntity(row) : null;
    } catch (error) {
      this.logGroupWarning('markRead_failed', { notificationId: id, error });
      return null;
    }
  }

  /**
   * Marca notificacao como nao lida
   */
  async markAsUnread(id: string, user: unknown): Promise<Notification | null> {
    const actor = this.normalizeNotificationActor(user);
    const existing = await this.findAccessibleNotificationRow(id, actor, 'read');
    if (!existing) {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }

    try {
      await this.markNotificationUnreadWithGroup(id, existing.notificationGroupId);

      const row = await this.prisma.notification.findUnique({
        where: { id: existing.id },
      });

      this.logger.log(`Notificacao marcada como nao lida: ${id}`);
      return row ? this.mapToEntity(row) : null;
    } catch (error) {
      this.logGroupWarning('markUnread_failed', { notificationId: id, error });
      return null;
    }
  }

  /**
   * Marca todas as notificacoes como lidas
   */
  async markAllAsRead(user: unknown, filters?: NotificationFilters): Promise<number> {
    const where = this.buildWhereClause(user, filters);
    const unreadWhere = this.buildUnreadWhere(where);

    const affectedGroupIds = await this.prisma.notification.findMany({
      where: unreadWhere,
      select: { notificationGroupId: true },
      distinct: ['notificationGroupId'],
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.notification.updateMany({
        where: unreadWhere,
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
      });

      const groupIds = affectedGroupIds
        .map((n) => n.notificationGroupId)
        .filter((id): id is string => Boolean(id));

      for (const groupId of groupIds) {
        await this.recalculateGroupUnreadCount(tx, groupId);
      }

      return updateResult;
    });

    this.logger.log(`${result.count} notificacoes marcadas como lidas`);
    return result.count;
  }

  /**
   * Deleta uma notificacao
   */
  async delete(id: string, user: unknown): Promise<Notification | null> {
    const actor = this.normalizeNotificationActor(user);
    const existing = await this.findAccessibleNotificationRow(id, actor, 'delete');
    if (!existing) {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }

    const wasRead = Boolean(existing.read ?? existing.isRead);
    const groupId = existing.notificationGroupId;

    try {
      await this.deleteNotificationWithGroup(id, wasRead, groupId);

      this.logger.log(`Notificacao deletada: ${id}`);
      return this.mapToEntity(existing);
    } catch (error) {
      this.logGroupWarning('delete_failed', { notificationId: id, groupId, error });
      return null;
    }
  }

  /**
   * Deleta multiplas notificacoes
   */
  async deleteMany(ids: string[], user: unknown): Promise<number> {
    const normalizedIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (normalizedIds.length === 0) {
      return 0;
    }

    const where = {
      AND: [
        { id: { in: normalizedIds } },
        this.buildWhereClause(user),
      ],
    };

    const accessibleNotifications = await this.prisma.notification.findMany({
      where,
      select: { id: true, notificationGroupId: true },
    });

    if (accessibleNotifications.length === 0) {
      return 0;
    }

    const accessibleIds = accessibleNotifications.map((n) => n.id);

    await this.prisma.$transaction(async (tx) => {
      const groupIdsNeedingPreviewRecalc = new Set<string>();

      for (const notif of accessibleNotifications) {
        if (!notif.notificationGroupId) continue;
        const group = await tx.notificationGroup.findUnique({
          where: { id: notif.notificationGroupId },
          select: { lastNotificationId: true },
        });
        if (group?.lastNotificationId === notif.id) {
          groupIdsNeedingPreviewRecalc.add(notif.notificationGroupId);
        }
      }

      await tx.notification.deleteMany({
        where: { id: { in: accessibleIds } },
      });

      const affectedGroupIds = [...new Set(
        accessibleNotifications
          .map((n) => n.notificationGroupId)
          .filter((id): id is string => Boolean(id)),
      )];

      for (const groupId of affectedGroupIds) {
        const { totalCount } = await this.syncGroupCounters(tx, groupId);

        if (totalCount === 0) {
          await tx.notificationGroup.delete({ where: { id: groupId } }).catch(() => {});
          this.logGroupOperation('deleteMany_emptyGroup', { groupId });
          continue;
        }

        if (groupIdsNeedingPreviewRecalc.has(groupId)) {
          await this.syncGroupPreview(tx, groupId);
        }

        this.logGroupOperation('deleteMany', {
          groupId,
          detail: `previewRecalc=${groupIdsNeedingPreviewRecalc.has(groupId)}`,
        });
      }
    });

    this.logger.log(`${accessibleIds.length} notificacoes deletadas`);
    return accessibleIds.length;
  }

  /**
   * Conta notificacoes nao lidas
   */
  async countUnread(user: unknown): Promise<number> {
    const where = this.buildUnreadWhere(this.buildWhereClause(user));

    return this.prisma.notification.count({ where });
  }

  /**
   * Envia notificacao em massa (Broadcast)
   */
  async broadcast(dto: BroadcastNotificationDto, authorInfo: unknown): Promise<{ count: number }> {
    if (!(await this.areNotificationsEnabled())) {
      return { count: 0 };
    }

    const actor = this.normalizeNotificationActor(authorInfo);
    const where: Prisma.UserWhereInput = {};

    if (dto.target === 'admins_only') {
      where.role = actor.role === 'SUPER_ADMIN' ? { in: ['ADMIN', 'SUPER_ADMIN'] } : 'ADMIN';
    } else if (dto.target === 'super_admins') {
      if (actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('ADMIN nao pode enviar broadcast para SUPER_ADMIN');
      }
      where.role = 'SUPER_ADMIN';
    }

    if (actor.role === 'ADMIN') {
      if (!actor.tenantId) {
        throw new ForbiddenException('ADMIN precisa de tenant valido para broadcast');
      }
      where.tenantId = actor.tenantId;
    } else if (dto.scope === 'tenants' && dto.tenantIds && dto.tenantIds.length > 0) {
      const tenantIds = dto.tenantIds.filter((tenantId): tenantId is string => typeof tenantId === 'string');
      if (tenantIds.length > 0) {
        where.tenantId = { in: tenantIds };
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, tenantId: true },
    });

    if (!users || users.length === 0) {
      return { count: 0 };
    }

    const dbSeverity = this.mapTypeToSeverity(dto.type || 'info');
    const metadata = this.sanitizeData({ broadcast: true, target: dto.target });

    const notificationsData = users.map((u) => ({
      type: 'SYSTEM_ALERT',
      title: dto.title,
      body: dto.description,
      message: dto.description,
      severity: dbSeverity,
      userId: u.id,
      targetUserId: u.id,
      targetRole: null,
      tenantId: u.tenantId,
      source: 'broadcast',
      audience: 'user',
      isRead: false,
      read: false,
      data: this.toInputJson(metadata),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await this.prisma.notification.createMany({
      data: notificationsData,
    });

    this.logger.log(`Broadcast enviado para ${result.count} usuarios. Scope: ${actor.role === 'ADMIN' ? 'tenant-admin' : dto.scope}`);

    return { count: result.count };
  }

  private async areNotificationsEnabled(): Promise<boolean> {
    return (await this.getNotificationsToggleState()).enabled;
  }

  /**
   * Busca uma notificacao por ID
   */
  async findById(id: string, user: unknown): Promise<Notification | null> {
    const actor = this.normalizeNotificationActor(user);
    const notification = await this.findAccessibleNotificationRow(id, actor, 'read');
    return notification ? this.mapToEntity(notification) : null;
  }

  // ============================================================================
  // METODOS PRIVADOS
  // ============================================================================

  private buildWhereClause(user: unknown, filters?: NotificationFilters): Prisma.NotificationWhereInput {
    const actor = this.normalizeNotificationActor(user);
    return this.authorizationService.buildNotificationWhere(actor, filters) as Prisma.NotificationWhereInput;
  }

  private normalizeNotificationActor(authorInfo: unknown): NormalizedNotificationActor {
    const actor =
      authorInfo && typeof authorInfo === 'object'
        ? (authorInfo as Record<string, unknown>)
        : {};

    return {
      id: typeof actor.id === 'string' ? actor.id : null,
      role: String(actor.role || '').trim().toUpperCase(),
      tenantId: typeof actor.tenantId === 'string' ? actor.tenantId : null,
    };
  }

  private buildUnreadWhere(baseWhere: Record<string, unknown>) {
    return {
      AND: [
        baseWhere,
        {
          OR: [{ read: false }, { isRead: false }],
        },
      ],
    };
  }

  private async findAccessibleNotificationRow(
    id: string,
    actor: { id: string | null; role: string; tenantId: string | null },
    action: 'read' | 'delete',
  ) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: { id },
      });

      if (!notification) {
        return null;
      }

      this.authorizationService.assertCanAccessNotification(actor, notification, action);
      return notification;
    } catch {
      return null;
    }
  }

  private async applyNotificationAuthorScope(data: NotificationCreateData, authorInfo?: unknown) {
    const actor = this.normalizeNotificationActor(authorInfo);
    if (!actor.role) {
      return data;
    }

    if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Usuario nao pode criar notificacoes arbitrarias');
    }

    const scopedData: NotificationCreateData = {
      ...data,
      tenantId: data.tenantId,
      userId: data.userId,
    };

    if (actor.role === 'ADMIN') {
      if (!actor.tenantId) {
        throw new ForbiddenException('ADMIN precisa de tenant valido para criar notificacoes');
      }

      scopedData.tenantId = actor.tenantId;

      if (data.userId) {
        const targetUser = await this.prisma.user.findFirst({
          where: {
            id: data.userId,
            tenantId: actor.tenantId,
          },
          select: { id: true },
        });

        if (!targetUser) {
          throw new ForbiddenException('Destino fora do tenant do administrador');
        }

        scopedData.userId = targetUser.id;
      }
    } else if (data.userId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, tenantId: true },
      });

      if (!targetUser) {
        throw new ForbiddenException('Usuario de destino nao encontrado');
      }

      scopedData.userId = targetUser.id;
      scopedData.tenantId = targetUser.tenantId;
    }

    return scopedData;
  }

  private mapToEntity(notification: PrismaNotification): Notification {
    return {
      id: notification.id,
      title: notification.title,
      description: notification.body || notification.message,
      type: this.mapSeverityToType(notification.severity),
      tenantId: notification.tenantId,
      userId: notification.userId,
      read: Boolean(notification.read ?? notification.isRead),
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
    switch (String(severity || '').toLowerCase()) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  }

  private mapTypeToSeverity(type: string): SystemNotificationSeverity {
    switch (String(type || '').toLowerCase()) {
      case 'error':
      case 'critical':
        return 'critical';
      case 'warning':
      case 'warn':
        return 'warning';
      default:
        return 'info';
    }
  }

  private normalizeSeverity(input: string): SystemNotificationSeverity {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === 'critical') {
      return 'critical';
    }
    if (normalized === 'warning' || normalized === 'warn') {
      return 'warning';
    }
    return 'info';
  }

  private normalizeAction(action: string): string {
    const normalized = String(action || '').trim().toUpperCase();
    return normalized || 'SYSTEM_ALERT';
  }

  private buildSystemListWhere(params: SystemNotificationListParams): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = this.buildSystemScopeWhere({
      targetRole: params.targetRole,
      targetUserId: params.targetUserId,
    });

    const severity = this.normalizeSeverityFilter(params.severity);
    if (severity) {
      where.severity = severity;
    }

    const shouldFilterUnread = Boolean(params.unreadOnly);
    if (params.isRead === true || params.isRead === false) {
      where.isRead = params.isRead;
    } else if (shouldFilterUnread) {
      where.isRead = false;
    }

    return where;
  }

  private resolveSystemScope(actor?: NotificationActorScope): Prisma.NotificationWhereInput {
    if (!actor) {
      return this.buildSystemScopeWhere({ targetRole: 'SUPER_ADMIN' });
    }

    const role = String(actor.role || actor.targetRole || '').trim().toUpperCase();
    if (role && role !== 'SUPER_ADMIN') {
      return { id: '__forbidden__' };
    }

    return this.buildSystemScopeWhere({
      targetRole: role || 'SUPER_ADMIN',
      targetUserId: actor.userId || actor.targetUserId,
    });
  }

  private buildSystemScopeWhere(scope?: {
    targetRole?: string;
    targetUserId?: string;
  }): Prisma.NotificationWhereInput {
    const targetRole = String(this.normalizeText(scope?.targetRole || 'SUPER_ADMIN', 40) || '').toUpperCase();
    const targetUserId = this.normalizeText(scope?.targetUserId || undefined, 80);
    const or: Prisma.NotificationWhereInput[] = [];

    if (targetRole) {
      or.push({ targetRole });
    }
    if (targetUserId) {
      or.push({ targetUserId });
    }
    if (targetRole === 'SUPER_ADMIN') {
      or.push({ audience: 'super_admin' });
    }

    if (or.length === 0) {
      return { targetRole: 'SUPER_ADMIN' };
    }

    return { OR: or };
  }

  private normalizeSeverityFilter(input?: string): SystemNotificationSeverity | null {
    if (!input) {
      return null;
    }

    const value = String(input || '').trim().toLowerCase();
    if (value === 'info' || value === 'warning' || value === 'warn' || value === 'critical') {
      return this.normalizeSeverity(value);
    }

    return null;
  }

  private buildSystemAlertTitle(action: string): string {
    return action
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private isSystemNotificationRecord(
    row: Pick<PrismaNotification, 'targetRole' | 'audience'> | null | undefined,
  ): boolean {
    if (!row) {
      return false;
    }

    const role = String(row.targetRole || '').toUpperCase();
    const audience = String(row.audience || '').toLowerCase();
    return role === 'SUPER_ADMIN' || audience === 'super_admin';
  }

  private toSystemNotificationDto(row: PrismaNotification): SystemNotificationDto {
    return {
      id: row.id,
      type: String(row.type || 'SYSTEM_ALERT'),
      severity: this.normalizeSeverity(row.severity),
      title: String(row.title || ''),
      body: String(row.body || row.message || ''),
      data: this.parseMetadata(row.data),
      module: this.normalizeText(row.module || undefined, 80) || null,
      source: this.normalizeText(row.source || undefined, 40) || null,
      createdAt: row.createdAt,
      isRead: Boolean(row.isRead ?? row.read),
      readAt: row.readAt || null,
    };
  }

  private sanitizeData(input: Record<string, unknown>): Record<string, unknown> {
    const sanitized = this.sanitizeValue(input, 0, null);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
      return {};
    }

    return sanitized as Record<string, unknown>;
  }

  private sanitizeValue(value: unknown, depth: number, key: string | null): unknown {
    if (depth >= 6) {
      return '[truncated]';
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.slice(0, 100).map((entry) => this.sanitizeValue(entry, depth + 1, key));
    }

    if (typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        if (this.shouldStoreAsCaptureFlag(childKey, childValue)) {
          output[this.toCapturedFlagKey(childKey)] = true;
          continue;
        }

        if (this.isSensitiveKey(childKey)) {
          output[childKey] = '[redacted]';
          continue;
        }

        if (this.isHeadersKey(childKey) && childValue && typeof childValue === 'object' && !Array.isArray(childValue)) {
          output[childKey] = this.sanitizeHeaders(childValue as Record<string, unknown>, depth + 1);
          continue;
        }

        output[childKey] = this.sanitizeValue(childValue, depth + 1, childKey);
      }
      return output;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      if (this.isSensitiveValue(trimmed, key)) {
        return '[redacted]';
      }

      let sanitized = this.redactSensitiveFragments(trimmed);

      if (key && /(path|file|directory|dir|env)/i.test(key) && this.looksLikePath(sanitized)) {
        if (this.isSensitivePathKey(key) || this.looksSensitivePath(sanitized)) {
          return '[path-redacted]';
        }
        return this.sanitizePath(sanitized);
      }

      sanitized = this.looksSensitivePath(sanitized) ? '[path-redacted]' : sanitized;
      return sanitized.length > 2000 ? `${sanitized.slice(0, 1997)}...` : sanitized;
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    return /(token|secret|password|authorization|cookie|api[-_]?key|private[-_]?key|database[_-]?url|connection|set-cookie|x-auth|x-access-token|x-maintenance-bypass)/i.test(
      key,
    );
  }

  private isSensitiveValue(value: string, key: string | null): boolean {
    if (/^-----BEGIN [A-Z ]+-----/.test(value)) {
      return true;
    }

    if (key && this.isSensitiveHeaderName(key)) {
      return true;
    }

    if (/^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(value)) {
      return true;
    }

    if (/(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:[^@\s/]+@/i.test(value)) {
      return true;
    }

    return false;
  }

  private sanitizePath(value: string): string {
    const normalized = value.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) {
      return '[path-redacted]';
    }

    return `[path-redacted]/${parts[parts.length - 1]}`;
  }

  private sanitizeHeaders(headers: Record<string, unknown>, depth: number): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (this.isSensitiveHeaderName(headerName)) {
        sanitized[headerName] = '[redacted]';
        continue;
      }

      sanitized[headerName] = this.sanitizeValue(headerValue, depth + 1, headerName);
    }

    return sanitized;
  }

  private isHeadersKey(key: string): boolean {
    return /(headers|requestheaders|responseheaders)/i.test(key);
  }

  private isSensitiveHeaderName(headerName: string): boolean {
    return /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|x-refresh-token|x-csrf-token|x-xsrf-token|x-maintenance-bypass)$/i.test(
      headerName.trim(),
    );
  }

  private isSensitivePathKey(key: string): boolean {
    return /(env|secret|credential|private|token|key|snapshot|pem|p12|pfx)/i.test(key);
  }

  private looksLikePath(value: string): boolean {
    return /[\\/]/.test(value);
  }

  private looksSensitivePath(value: string): boolean {
    return /(^|[\\/])\.env([./\\]|$)|([\\/])(secrets?|credentials?|private|keys?|\.ssh)([\\/]|$)|id_rsa|\.pem\b|\.p12\b|\.pfx\b|\.key\b/i.test(
      value,
    );
  }

  private shouldStoreAsCaptureFlag(key: string, value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (!this.looksLikePath(value.trim())) {
      return false;
    }

    return /(env.*snapshot.*(path|file)|snapshot.*env.*(path|file)|envSnapshotPath)/i.test(key);
  }

  private toCapturedFlagKey(key: string): string {
    const base = key.replace(/(file(path)?|path|directory|dir)$/i, '');
    const normalizedBase = base.trim() || key;
    return /captured$/i.test(normalizedBase) ? normalizedBase : `${normalizedBase}Captured`;
  }

  private redactSensitiveFragments(value: string): string {
    let sanitized = value;

    sanitized = sanitized.replace(/\b(Bearer)\s+[A-Za-z0-9\-._~+/=]+/gi, '$1 [redacted]');
    sanitized = sanitized.replace(
      /\b(authorization|proxy-authorization|token|secret|password|passwd|api[-_]?key|x-api-key|x-maintenance-bypass|cookie|set-cookie|database_url)\b\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[redacted]',
    );
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-jwt]');
    sanitized = sanitized.replace(
      /((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:)([^@\s/]+)@/gi,
      '$1[redacted]@',
    );
    sanitized = sanitized.replace(/([A-Za-z]:)?[\\/][^\s'"`]*\.env(?:\.[^\s'"`]*)?/gi, '[path-redacted]');

    return sanitized;
  }

  private parseMetadata(data: unknown): Record<string, unknown> {
    if (!data) {
      return {};
    }

    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data || '{}');
        return this.isRecord(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    if (this.isRecord(data)) {
      return data;
    }

    return {};
  }

  private toInputJson(data: Record<string, unknown>): Prisma.InputJsonValue {
    return data as Prisma.InputJsonValue;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeText(value: string | undefined, maxLength: number): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number): string | null {
    const normalized = this.normalizeText(value, maxLength);
    return normalized || null;
  }

  private clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Math.floor(value)));
  }

  // ============================================================================
  // AGRUPAMENTO DE NOTIFICACOES — CORREÇÃO DE CONCORRÊNCIA
  //
  // Estratégia:
  // Os contadores unreadCount e totalCount são CAMPOS DERIVADOS.
  // Nunca confiar em valor lido para decidir incremento/decremento.
  // Sempre recalcular a partir dos dados reais (notifications table)
  // após cada operação que modifica o grupo.
  //
  // Isso elimina TODOS os read-modify-write vulneráveis a lost update.
  // A única operação atômica usada é { increment: N } para totalCount
  // na criação (que é idempotente por causa do unique constraint).
  //
  // Preview é recalculado SOMENTE quando a notificação alterada/deletada
  // era a lastNotificationId do grupo.
  // ============================================================================

  /**
   * Determina o escopo de agrupamento para uma notificacao.
   */
  private resolveGroupScope(inputModule?: string | null): { scopeType: string; scopeKey: string } {
    const mod = String(inputModule || '').trim();
    if (mod && mod.toLowerCase() !== 'system') {
      return { scopeType: 'module', scopeKey: mod };
    }
    return { scopeType: 'system', scopeKey: 'general' };
  }

  /**
   * Log estruturado para operacoes de agrupamento.
   * Usa DEBUG para operações normais de sincronização,
   * LOG para operações de criação/modificação significativas.
   */
  private logGroupOperation(
    operation: string,
    context: {
      tenantId?: string | null;
      userId?: string | null;
      groupId?: string | null;
      notificationId?: string | null;
      module?: string | null;
      scopeType?: string;
      scopeKey?: string;
      detail?: string;
    },
  ) {
    this.logger.log(
      `[GroupOp] ${operation} | tenant=${context.tenantId ?? '-'} user=${context.userId ?? '-'} ` +
      `group=${context.groupId ?? '-'} notif=${context.notificationId ?? '-'} ` +
      `scope=${context.scopeType ?? '-'}:${context.scopeKey ?? '-'} ` +
      `${context.detail ? '| ' + context.detail : ''}`,
    );
  }

  /**
   * Log de warning estruturado para inconsistencias de agrupamento.
   */
  private logGroupWarning(
    operation: string,
    context: {
      tenantId?: string | null;
      userId?: string | null;
      groupId?: string | null;
      notificationId?: string | null;
      error?: unknown;
      detail?: string;
    },
  ) {
    this.logger.warn(
      `[GroupWarn] ${operation} | tenant=${context.tenantId ?? '-'} user=${context.userId ?? '-'} ` +
      `group=${context.groupId ?? '-'} notif=${context.notificationId ?? '-'} ` +
      `err=${context.error ? String(context.error) : '-'} ` +
      `${context.detail ? '| ' + context.detail : ''}`,
    );
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE RECÁLCULO — fonte de verdade: notifications table
  // ---------------------------------------------------------------------------

  /**
   * Sincroniza totalCount e unreadCount do grupo a partir das notificações reais.
   * Não depende de valor anterior lido. Elimina lost update.
   */
  private async syncGroupCounters(tx: Prisma.TransactionClient, groupId: string) {
    const [totalCount, unreadCount] = await Promise.all([
      tx.notification.count({ where: { notificationGroupId: groupId } }),
      tx.notification.count({
        where: {
          notificationGroupId: groupId,
          OR: [{ read: false }, { isRead: false }],
        },
      }),
    ]);

    await tx.notificationGroup.update({
      where: { id: groupId },
      data: {
        totalCount: Math.max(0, totalCount),
        unreadCount: Math.max(0, Math.min(unreadCount, totalCount)),
      },
    });

    return { totalCount, unreadCount };
  }

  /**
   * Sincroniza preview (lastNotification*) do grupo a partir da notificação mais recente.
   * Chamado SOMENTE quando a notificação que era lastNotificationId foi alterada/deletada.
   */
  private async syncGroupPreview(tx: Prisma.TransactionClient, groupId: string) {
    const latest = await tx.notification.findFirst({
      where: { notificationGroupId: groupId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true, message: true, createdAt: true },
    });

    if (latest) {
      await tx.notificationGroup.update({
        where: { id: groupId },
        data: {
          lastNotificationId: latest.id,
          lastNotificationAt: latest.createdAt,
          lastTitle: latest.title,
          lastBody: latest.body || latest.message,
        },
      });
    } else {
      await tx.notificationGroup.update({
        where: { id: groupId },
        data: { lastNotificationId: null },
      });
    }
  }

  /**
   * Sincronização completa de um grupo: contadores + preview.
   * Usado quando não sabemos se a notificação afetada era a última.
   */
  private async syncGroupFull(tx: Prisma.TransactionClient, groupId: string) {
    const { totalCount } = await this.syncGroupCounters(tx, groupId);

    if (totalCount === 0) {
      await tx.notificationGroup.delete({ where: { id: groupId } }).catch(() => {});
      return;
    }

    await this.syncGroupPreview(tx, groupId);
  }

  // ---------------------------------------------------------------------------
  // OPERAÇÕES DE CRIAÇÃO
  // ---------------------------------------------------------------------------

  /**
   * Associa uma notificação ao grupo de agrupamento.
   * Usa upsert (atómico pelo unique constraint) + incremento atômico para totalCount.
   * unreadCount é sincronizado a partir dos dados reais para evitar drift.
   */
  private async assignNotificationToGroup(
    notification: PrismaNotification,
    inputModule?: string | null,
  ) {
    const { scopeType, scopeKey } = this.resolveGroupScope(inputModule);
    const tenantId = notification.tenantId || null;
    const userId = notification.userId || null;
    const previewBody = notification.body || notification.message;
    const isUnread = !notification.read && !notification.isRead;

    await this.prisma.$transaction(async (tx) => {
      const group = await tx.notificationGroup.upsert({
        where: {
          tenantId_userId_scopeType_scopeKey: {
            tenantId: tenantId ?? '',
            userId: userId ?? '',
            scopeType,
            scopeKey,
          },
        },
        create: {
          tenantId,
          userId,
          scopeType,
          scopeKey,
          lastTitle: notification.title,
          lastBody: previewBody,
          unreadCount: isUnread ? 1 : 0,
          totalCount: 1,
          lastNotificationId: notification.id,
          lastNotificationAt: new Date(),
        },
        update: {},
      });

      await tx.notification.update({
        where: { id: notification.id },
        data: { notificationGroupId: group.id },
      });

      if (group.totalCount > 0) {
        await tx.notificationGroup.update({
          where: { id: group.id },
          data: {
            totalCount: { increment: 1 },
            lastNotificationId: notification.id,
            lastNotificationAt: new Date(),
            lastTitle: notification.title,
            lastBody: previewBody,
          },
        });

        await this.syncGroupCounters(tx, group.id);
      }

      this.logGroupOperation('assign', {
        tenantId,
        userId,
        groupId: group.id,
        notificationId: notification.id,
        scopeType,
        scopeKey,
        detail: `unread=${isUnread}`,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // OPERAÇÕES DE LEITURA / MARCAÇÃO
  // ---------------------------------------------------------------------------

  /**
   * Marca notificação como lida.
   * Após atualizar a notificação, recalca unreadCount do grupo a partir dos dados reais.
   * NÃO usa decremento baseado em valor lido.
   */
  private async markNotificationReadWithGroup(
    notificationId: string,
    existingGroupId: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id: notificationId },
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
      });

      if (existingGroupId) {
        await this.syncGroupCounters(tx, existingGroupId);

        this.logGroupOperation('markRead', {
          groupId: existingGroupId,
          notificationId,
        });
      }
    });
  }

  /**
   * Marca notificação como não lida.
   * Após atualizar a notificação, recalca unreadCount do grupo a partir dos dados reais.
   * NÃO usa incremento baseado em valor lido.
   */
  private async markNotificationUnreadWithGroup(
    notificationId: string,
    existingGroupId: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id: notificationId },
        data: {
          read: false,
          isRead: false,
          readAt: null,
        },
      });

      if (existingGroupId) {
        await this.syncGroupCounters(tx, existingGroupId);

        this.logGroupOperation('markUnread', {
          groupId: existingGroupId,
          notificationId,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // OPERAÇÕES DE EXCLUSÃO
  // ---------------------------------------------------------------------------

  /**
   * Deleta notificação e atualiza grupo.
   * Recalca contadores a partir dos dados reais.
   * Preview recalculado SOMENTE se notificationId == lastNotificationId.
   * Grupo deletado se ficar vazio.
   */
  private async deleteNotificationWithGroup(
    notificationId: string,
    _wasRead: boolean,
    groupId: string | null,
  ) {
    if (!groupId) {
      await this.prisma.notification.delete({ where: { id: notificationId } });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const group = await tx.notificationGroup.findUnique({
        where: { id: groupId },
        select: { lastNotificationId: true },
      });

      if (!group) {
        await tx.notification.delete({ where: { id: notificationId } }).catch(() => {});
        return;
      }

      const needsPreviewRecalc = group.lastNotificationId === notificationId;

      await tx.notification.delete({ where: { id: notificationId } });

      const { totalCount } = await this.syncGroupCounters(tx, groupId);

      if (totalCount === 0) {
        await tx.notificationGroup.delete({ where: { id: groupId } });
        this.logGroupOperation('deleteGroup', { groupId, notificationId, detail: 'empty' });
        return;
      }

      if (needsPreviewRecalc) {
        await this.syncGroupPreview(tx, groupId);
      }

      this.logGroupOperation('delete', {
        groupId,
        notificationId,
        detail: `previewRecalc=${needsPreviewRecalc}`,
      });
    });
  }

  /**
   * Recalcula unreadCount de um grupo a partir do banco.
   * Wrapper sobre syncGroupCounters para compatibilidade.
   */
  private async recalculateGroupUnreadCount(
    tx: Prisma.TransactionClient,
    groupId: string,
  ) {
    await this.syncGroupCounters(tx, groupId);
  }

  /**
   * Valida consistência de um grupo (para debug/diagnóstico).
   * Compara contadores armazenados com contagens reais do banco.
   * Repara automaticamente se divergente.
   */
  private async validateGroupConsistency(groupId: string): Promise<boolean> {
    try {
      const group = await this.prisma.notificationGroup.findUnique({
        where: { id: groupId },
        select: { totalCount: true, unreadCount: true },
      });

      if (!group) return true;

      const [actualTotal, actualUnread] = await Promise.all([
        this.prisma.notification.count({
          where: { notificationGroupId: groupId },
        }),
        this.prisma.notification.count({
          where: {
            notificationGroupId: groupId,
            OR: [{ read: false }, { isRead: false }],
          },
        }),
      ]);

      const totalMismatch = group.totalCount !== actualTotal;
      const unreadMismatch = group.unreadCount !== actualUnread;

      if (totalMismatch || unreadMismatch) {
        this.logGroupWarning('consistency_mismatch', {
          groupId,
          detail: `stored(total=${group.totalCount},unread=${group.unreadCount}) ` +
                  `actual(total=${actualTotal},unread=${actualUnread})`,
        });

        await this.prisma.notificationGroup.update({
          where: { id: groupId },
          data: {
            totalCount: actualTotal,
            unreadCount: Math.max(0, Math.min(actualUnread, actualTotal)),
          },
        });

        this.logGroupOperation('consistency_repair', {
          groupId,
          detail: `corrected to total=${actualTotal} unread=${actualUnread}`,
        });

        return false;
      }

      return true;
    } catch (error) {
      this.logGroupWarning('consistency_check_failed', { groupId, error });
      return false;
    }
  }

  // ============================================================================
  // ENDPOINTS AGRUPADOS
  // ============================================================================

  async listGroups(user: unknown, params: { page?: number; limit?: number } = {}) {
    const actor = this.normalizeNotificationActor(user);
    const page = this.clampNumber(params.page, 1, 100000, 1);
    const limit = this.clampNumber(params.limit, 1, 100, 20);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationGroupWhereInput = {};
    if (actor.tenantId) {
      where.tenantId = actor.tenantId;
    } else if (actor.role === 'SUPER_ADMIN') {
      where.tenantId = null;
    }

    if (actor.id) {
      where.OR = [
        { userId: actor.id },
        { userId: null },
      ];
    }

    const [groups, total] = await Promise.all([
      this.prisma.notificationGroup.findMany({
        where,
        orderBy: { lastNotificationAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationGroup.count({ where }),
    ]);

    return {
      groups: groups.map((g) => ({
        id: g.id,
        tenantId: g.tenantId,
        userId: g.userId,
        scopeType: g.scopeType,
        scopeKey: g.scopeKey,
        unreadCount: g.unreadCount,
        totalCount: g.totalCount,
        lastNotificationAt: g.lastNotificationAt,
        lastTitle: g.lastTitle,
        lastBody: g.lastBody,
      })),
      total,
      page,
      limit,
      hasMore: skip + groups.length < total,
    };
  }

  async listSystemGroups(params: { page?: number; limit?: number } = {}) {
    const page = this.clampNumber(params.page, 1, 100000, 1);
    const limit = this.clampNumber(params.limit, 1, 100, 20);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationGroupWhereInput = {
      tenantId: null,
    };

    const [groups, total] = await Promise.all([
      this.prisma.notificationGroup.findMany({
        where,
        orderBy: { lastNotificationAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationGroup.count({ where }),
    ]);

    return {
      groups: groups.map((g) => ({
        id: g.id,
        tenantId: g.tenantId,
        userId: g.userId,
        scopeType: g.scopeType,
        scopeKey: g.scopeKey,
        unreadCount: g.unreadCount,
        totalCount: g.totalCount,
        lastNotificationAt: g.lastNotificationAt,
        lastTitle: g.lastTitle,
        lastBody: g.lastBody,
      })),
      total,
      page,
      limit,
      hasMore: skip + groups.length < total,
    };
  }

  async listGroupItems(
    groupId: string,
    user: unknown,
    params: { page?: number; limit?: number } = {},
  ) {
    const actor = this.normalizeNotificationActor(user);
    const page = this.clampNumber(params.page, 1, 100000, 1);
    const limit = this.clampNumber(params.limit, 1, 100, 20);
    const skip = (page - 1) * limit;

    const group = await this.prisma.notificationGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { notifications: [], total: 0, page, limit, hasMore: false };
    }

    const where: Prisma.NotificationWhereInput = {
      notificationGroupId: groupId,
    };

    if (actor.role !== 'SUPER_ADMIN') {
      if (actor.tenantId) {
        where.tenantId = actor.tenantId;
      }
      if (actor.id) {
        where.OR = [
          { userId: actor.id },
          { userId: null },
        ];
      }
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map((n) => this.mapToEntity(n)),
      total,
      page,
      limit,
      hasMore: skip + notifications.length < total,
    };
  }

  async markGroupAsRead(groupId: string, user: unknown): Promise<number> {
    const actor = this.normalizeNotificationActor(user);

    const group = await this.prisma.notificationGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return 0;
    }

    const where: Prisma.NotificationWhereInput = {
      notificationGroupId: groupId,
      OR: [{ read: false }, { isRead: false }],
    };

    if (actor.role !== 'SUPER_ADMIN') {
      if (actor.tenantId) {
        where.tenantId = actor.tenantId;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.notification.updateMany({
        where,
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
      });

      await this.syncGroupCounters(tx, groupId);

      return updateResult;
    });

    this.logGroupOperation('markGroupRead', {
      groupId,
      detail: `count=${result.count}`,
    });

    return result.count;
  }
}
