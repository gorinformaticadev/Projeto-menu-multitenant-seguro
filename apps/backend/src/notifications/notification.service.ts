/**
 * NOTIFICATION SERVICE - Logica de negocio e persistencia
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { Observable, Subject } from 'rxjs';
import {
  Notification,
  NotificationCreateData,
  NotificationFilters,
  NotificationResponse,
} from './notification.entity';
import { BroadcastNotificationDto } from './notification.dto';

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
  createdAt: Date;
  isRead: boolean;
  readAt: Date | null;
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
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly systemAlertsSubject = new Subject<SystemNotificationDto>();

  constructor(private prisma: PrismaService) {
    // Empty implementation
  }

  getSystemAlertStream(): Observable<SystemNotificationDto> {
    return this.systemAlertsSubject.asObservable();
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
    const targetUserId = this.normalizeText(input.targetUserId || undefined, 80);
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
    const severity = this.normalizeSeverity(input.severity);
    const title = this.normalizeText(input.title, 140);
    const body = this.normalizeText(input.body, 500);
    const targetRole = this.normalizeText(input.targetRole || 'SUPER_ADMIN', 40);
    const targetUserId = this.normalizeText(input.targetUserId || undefined, 80);
    const type = this.normalizeText(input.type || 'SYSTEM_ALERT', 40);
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
          data: data as any,
          targetRole,
          targetUserId,
          isRead: false,
          read: false,
          readAt: null,
          audience: targetUserId ? 'user' : 'super_admin',
          source: 'system',
          module: 'system',
          tenantId: null,
          userId: targetUserId,
        },
      });

      const dto = this.toSystemNotificationDto(notification);
      this.systemAlertsSubject.next(dto);
      return dto;
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
      const updated = await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          ...scope,
        },
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return null;
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
      const result = await this.prisma.notification.updateMany({
        where: {
          ...scope,
          isRead: false,
        },
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
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

  /**
   * Cria uma nova notificacao
   */
  async create(data: NotificationCreateData): Promise<Notification> {
    try {
      const severity = this.mapTypeToSeverity(data.type);
      const notification = await this.prisma.notification.create({
        data: {
          type: 'SYSTEM_ALERT',
          title: data.title,
          body: data.description,
          message: data.description,
          severity,
          audience: this.determineAudience(data.tenantId, data.userId),
          source: 'core',
          tenantId: data.tenantId,
          userId: data.userId,
          targetRole: data.userId ? null : data.tenantId ? 'ADMIN' : 'SUPER_ADMIN',
          targetUserId: data.userId,
          data: this.sanitizeData(data.metadata || {}) as any,
          isRead: false,
          read: false,
        },
      });

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

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, OR: [{ read: false }, { isRead: false }] },
      }),
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
        where: { ...where, OR: [{ read: false }, { isRead: false }] },
      }),
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
    const where = {
      id,
      ...this.buildWhereClause(user),
    };

    try {
      const notification = await this.prisma.notification.update({
        where,
        data: {
          read: true,
          isRead: true,
          readAt: new Date(),
        },
      });

      this.logger.log(`Notificacao marcada como lida: ${id}`);
      return this.mapToEntity(notification);
    } catch {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }
  }

  /**
   * Marca notificacao como nao lida
   */
  async markAsUnread(id: string, user: unknown): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user),
    };

    try {
      const notification = await this.prisma.notification.update({
        where,
        data: {
          read: false,
          isRead: false,
          readAt: null,
        },
      });

      this.logger.log(`Notificacao marcada como nao lida: ${id}`);
      return this.mapToEntity(notification);
    } catch {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }
  }

  /**
   * Marca todas as notificacoes como lidas
   */
  async markAllAsRead(user: any, filters?: NotificationFilters): Promise<number> {
    const where = this.buildWhereClause(user, filters);

    const result = await this.prisma.notification.updateMany({
      where: {
        ...where,
        OR: [{ read: false }, { isRead: false }],
      },
      data: {
        read: true,
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.log(`${result.count} notificacoes marcadas como lidas`);
    return result.count;
  }

  /**
   * Deleta uma notificacao
   */
  async delete(id: string, user: unknown): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user),
    };

    try {
      const notification = await this.prisma.notification.delete({
        where,
      });

      this.logger.log(`Notificacao deletada: ${id}`);
      return this.mapToEntity(notification);
    } catch {
      this.logger.warn(`Notificacao nao encontrada ou sem permissao: ${id}`);
      return null;
    }
  }

  /**
   * Deleta multiplas notificacoes
   */
  async deleteMany(ids: string[], user: unknown): Promise<number> {
    const where = {
      id: { in: ids },
      ...this.buildWhereClause(user),
    };

    const result = await this.prisma.notification.deleteMany({
      where,
    });

    this.logger.log(`${result.count} notificacoes deletadas`);
    return result.count;
  }

  /**
   * Conta notificacoes nao lidas
   */
  async countUnread(user: unknown): Promise<number> {
    const where = {
      ...this.buildWhereClause(user),
      OR: [{ read: false }, { isRead: false }],
    };

    return this.prisma.notification.count({ where });
  }

  /**
   * Envia notificacao em massa (Broadcast)
   */
  async broadcast(dto: BroadcastNotificationDto, _authorInfo: unknown): Promise<{ count: number }> {
    const where: any = {};

    if (dto.target === 'admins_only') {
      where.role = { in: ['ADMIN', 'SUPER_ADMIN'] };
    } else if (dto.target === 'super_admins') {
      where.role = 'SUPER_ADMIN';
    }

    if (dto.scope === 'tenants' && dto.tenantIds && dto.tenantIds.length > 0) {
      where.tenantId = { in: dto.tenantIds };
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
      data: metadata as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await this.prisma.notification.createMany({
      data: notificationsData,
    });

    this.logger.log(`Broadcast enviado para ${result.count} usuarios. Scope: ${dto.scope}`);

    return { count: result.count };
  }

  /**
   * Busca uma notificacao por ID
   */
  async findById(id: string, user: unknown): Promise<Notification | null> {
    const where = {
      id,
      ...this.buildWhereClause(user),
    };

    try {
      const notification = await this.prisma.notification.findUnique({
        where,
      });

      return notification ? this.mapToEntity(notification) : null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // METODOS PRIVADOS
  // ============================================================================

  private buildWhereClause(user: any, filters?: NotificationFilters) {
    const where: any = {};

    if (user.role === 'USER') {
      where.userId = user.id;
    } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      if (user.tenantId) {
        where.OR = [{ tenantId: user.tenantId }, { userId: user.id }];
      } else {
        where.OR = [{ userId: user.id }, { userId: null, tenantId: null }];
      }
    }

    if (filters) {
      if (filters.type) {
        where.severity = this.mapTypeToSeverity(filters.type);
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

  private buildSystemListWhere(params: SystemNotificationListParams): any {
    const where: any = this.buildSystemScopeWhere({
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

  private resolveSystemScope(actor?: NotificationActorScope): any {
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

  private buildSystemScopeWhere(scope?: { targetRole?: string; targetUserId?: string }): any {
    const targetRole = String(this.normalizeText(scope?.targetRole || 'SUPER_ADMIN', 40) || '').toUpperCase();
    const targetUserId = this.normalizeText(scope?.targetUserId || undefined, 80);
    const or: any[] = [];

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

  private isSystemNotificationRecord(row: any): boolean {
    if (!row) {
      return false;
    }

    const role = String(row.targetRole || '').toUpperCase();
    const audience = String(row.audience || '').toLowerCase();
    return role === 'SUPER_ADMIN' || audience === 'super_admin';
  }

  private toSystemNotificationDto(row: any): SystemNotificationDto {
    return {
      id: row.id,
      type: String(row.type || 'SYSTEM_ALERT'),
      severity: this.normalizeSeverity(row.severity),
      title: String(row.title || ''),
      body: String(row.body || row.message || ''),
      data: this.parseMetadata(row.data),
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

  private parseMetadata(data: unknown): Record<string, any> {
    if (!data) {
      return {};
    }

    if (typeof data === 'string') {
      try {
        return JSON.parse(data || '{}');
      } catch {
        return {};
      }
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, any>;
    }

    return {};
  }

  private normalizeText(value: string | undefined, maxLength: number): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
  }

  private clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Math.floor(value)));
  }
}
