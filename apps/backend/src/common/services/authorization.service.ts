import { ForbiddenException, Injectable } from '@nestjs/common';
import { SecurityActor } from './request-security-context.service';

type SecureFileRecord = {
  id: string;
  tenantId: string;
  uploadedBy: string;
};

type NotificationRecord = {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  targetRole?: string | null;
  targetUserId?: string | null;
  audience?: string | null;
};

type NotificationFilters = {
  type?: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
  tenantId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

@Injectable()
export class AuthorizationService {
  assertCanReadSecureFile(actor: SecurityActor, file: SecureFileRecord): void {
    if (!this.canReadSecureFile(actor, file)) {
      throw new ForbiddenException('Acesso ao arquivo negado');
    }
  }

  assertCanDeleteSecureFile(actor: SecurityActor, file: SecureFileRecord): void {
    if (!this.canDeleteSecureFile(actor, file)) {
      throw new ForbiddenException('Exclusao do arquivo negada');
    }
  }

  canReadSecureFile(actor: SecurityActor, file: SecureFileRecord): boolean {
    if (this.isSuperAdmin(actor)) {
      return true;
    }

    if (!this.belongsToSameTenant(actor, file.tenantId)) {
      return false;
    }

    return file.uploadedBy === actor.id || this.isTenantAdmin(actor);
  }

  canDeleteSecureFile(actor: SecurityActor, file: SecureFileRecord): boolean {
    if (this.isSuperAdmin(actor)) {
      return true;
    }

    if (!this.belongsToSameTenant(actor, file.tenantId)) {
      return false;
    }

    return file.uploadedBy === actor.id || this.isTenantAdmin(actor);
  }

  buildSecureFileListWhere(
    actor: SecurityActor,
    baseWhere: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isSuperAdmin(actor)) {
      return baseWhere;
    }

    const tenantId = this.requireTenantId(actor);
    const scopedWhere: Record<string, unknown> = {
      ...baseWhere,
      tenantId,
    };

    if (!this.isTenantAdmin(actor)) {
      scopedWhere.uploadedBy = actor.id;
    }

    return scopedWhere;
  }

  buildNotificationWhere(
    actor: SecurityActor,
    filters: NotificationFilters = {},
  ): Record<string, unknown> {
    const role = this.normalizeRole(actor.role);
    const where: Record<string, unknown> = {};
    const visibility: Record<string, unknown>[] = [];

    if (role === 'SUPER_ADMIN') {
      visibility.push({ userId: actor.id });
      visibility.push({ tenantId: null, userId: null });

      if (filters.tenantId) {
        visibility.push({
          tenantId: filters.tenantId,
          userId: null,
        });
      }

      if (filters.userId) {
        visibility.length = 0;
        visibility.push({ userId: filters.userId });
      }
    } else if (role === 'ADMIN') {
      const tenantId = this.requireTenantId(actor);
      visibility.push({ userId: actor.id });
      visibility.push({
        tenantId,
        userId: null,
        targetRole: 'ADMIN',
      });

      if (filters.userId && filters.userId !== actor.id) {
        throw new ForbiddenException('ADMIN nao pode filtrar notificacoes de outro usuario');
      }

      if (filters.tenantId && filters.tenantId !== tenantId) {
        throw new ForbiddenException('ADMIN nao pode consultar notificacoes de outro tenant');
      }
    } else {
      if (filters.userId && filters.userId !== actor.id) {
        throw new ForbiddenException('Usuario nao pode filtrar notificacoes de outro usuario');
      }

      visibility.push({ userId: actor.id });
    }

    where.OR = visibility;

    if (filters.type) {
      where.severity = this.mapNotificationTypeToSeverity(filters.type);
    }
    if (filters.read !== undefined) {
      where.read = filters.read;
    }
    if (filters.dateFrom) {
      where.createdAt = { ...(where.createdAt as object), gte: filters.dateFrom };
    }
    if (filters.dateTo) {
      where.createdAt = { ...(where.createdAt as object), lte: filters.dateTo };
    }

    return where;
  }

  assertCanAccessNotification(
    actor: SecurityActor,
    notification: NotificationRecord,
    action: 'read' | 'delete',
  ): void {
    if (!this.canAccessNotification(actor, notification, action)) {
      throw new ForbiddenException('Acesso a notificacao negado');
    }
  }

  canReceiveNotification(
    actor: SecurityActor,
    notification: NotificationRecord,
  ): boolean {
    return this.canAccessNotification(actor, notification, 'read');
  }

  canAccessNotification(
    actor: SecurityActor,
    notification: NotificationRecord,
    _action: 'read' | 'delete',
  ): boolean {
    if (this.isSuperAdmin(actor)) {
      // SUPER_ADMIN global (sem tenantId) pode ler tudo
      if (actor.tenantId == null) {
        return true;
      }

      // SUPER_ADMIN com tenantId (caso do seed antigo) segue a mesma regra de visibilidade:
      // Pode ler o que for dele, ou o que for global (tenantId null && userId null).
      // NAO pode ler notificacoes administrativas de um tenant so porque tem o mesmo tenantId.
      return (
        notification.userId === actor.id ||
        (notification.tenantId == null && notification.userId == null)
      );
    }

    if (notification.userId) {
      return notification.userId === actor.id;
    }

    if (!this.belongsToSameTenant(actor, notification.tenantId || null)) {
      return false;
    }

    return this.isTenantAdmin(actor) && this.normalizeRole(notification.targetRole) === 'ADMIN';
  }

  private mapNotificationTypeToSeverity(type: NotificationFilters['type']): string {
    switch (String(type || '').toLowerCase()) {
      case 'error':
        return 'critical';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  private belongsToSameTenant(actor: SecurityActor, tenantId: string | null): boolean {
    return this.isSuperAdmin(actor) || (tenantId != null && actor.tenantId === tenantId);
  }

  private isTenantAdmin(actor: SecurityActor): boolean {
    return this.normalizeRole(actor.role) === 'ADMIN';
  }

  private isSuperAdmin(actor: SecurityActor): boolean {
    return this.normalizeRole(actor.role) === 'SUPER_ADMIN';
  }

  private requireTenantId(actor: SecurityActor): string {
    const tenantId = typeof actor.tenantId === 'string' && actor.tenantId.trim().length > 0
      ? actor.tenantId.trim()
      : null;

    if (!tenantId) {
      throw new ForbiddenException('Contexto de tenant ausente');
    }

    return tenantId;
  }

  private normalizeRole(role: string | null | undefined): string {
    return String(role || '').trim().toUpperCase();
  }
}
