/**
 * NOTIFICATION PERMISSIONS - Controle de permissões de notificações
 * 
 * Gerencia quem pode ver, ler e deletar notificações
 */

import { Injectable } from '@nestjs/common';
import { NotificationRecord, NotificationPermissions } from './notification.types';

export interface UserContext {
  id: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'CLIENT';
  tenantId?: string | null;
}

@Injectable()
export class NotificationPermissionsService {

  /**
   * Verifica se usuário pode acessar uma notificação
   */
  canAccess(user: UserContext, notification: NotificationRecord): boolean {
    // Super admin pode acessar tudo
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Notificação específica para o usuário
    if (notification.userId === user.id) {
      return true;
    }

    // Admin pode acessar notificações do seu tenant (quando não são específicas de usuário)
    if (user.role === 'ADMIN' && notification.tenantId === user.tenantId && !notification.userId) {
      return true;
    }

    // Notificações globais (sem tenant e sem usuário) são visíveis para admins
    if (user.role === 'ADMIN' && !notification.tenantId && !notification.userId) {
      return true;
    }

    return false;
  }

  /**
   * Obtém permissões específicas do usuário para uma notificação
   */
  getPermissions(user: UserContext, notification: NotificationRecord): NotificationPermissions {
    const canAccess = this.canAccess(user, notification);
    
    if (!canAccess) {
      return {
        canRead: false,
        canDelete: false,
        canMarkAsRead: false
      };
    }

    // Permissões baseadas nas configurações da notificação
    const basePermissions = notification.permissions;

    return {
      canRead: basePermissions.canRead,
      canDelete: basePermissions.canDelete,
      canMarkAsRead: basePermissions.canRead // Se pode ler, pode marcar como lida
    };
  }

  /**
   * Filtra notificações baseado nas permissões do usuário
   */
  filterAccessible(user: UserContext, notifications: NotificationRecord[]): NotificationRecord[] {
    return notifications.filter(notification => this.canAccess(user, notification));
  }

  /**
   * Constrói filtro de banco baseado no usuário
   */
  buildDatabaseFilter(user: UserContext): any {
    if (user.role === 'SUPER_ADMIN') {
      // Super admin vê tudo
      return {};
    }

    if (user.role === 'ADMIN') {
      // Admin vê: suas próprias + do tenant (não específicas de usuário) + globais (não específicas de usuário)
      return {
        OR: [
          { userId: user.id }, // Suas próprias
          { 
            AND: [
              { tenantId: user.tenantId },
              { userId: null }
            ]
          }, // Do tenant (não específicas)
          {
            AND: [
              { tenantId: null },
              { userId: null }
            ]
          } // Globais (não específicas)
        ]
      };
    }

    // USER e CLIENT veem apenas suas próprias notificações
    return {
      userId: user.id
    };
  }

  /**
   * Determina audiência para uma notificação baseado no payload
   */
  determineAudience(payload: {
    tenantId?: string | null;
    userId?: string | null;
    type: 'info' | 'success' | 'warning' | 'error';
  }): Array<{ tenantId?: string | null; userId?: string | null }> {
    const audiences = [];

    // Se tem userId específico, é para o usuário
    if (payload.userId) {
      audiences.push({
        tenantId: payload.tenantId,
        userId: payload.userId
      });
    }
    // Se tem tenantId mas não userId, é para admins do tenant
    else if (payload.tenantId) {
      audiences.push({
        tenantId: payload.tenantId,
        userId: null
      });
    }
    // Se não tem nem userId nem tenantId, é global (super_admin)
    else {
      audiences.push({
        tenantId: null,
        userId: null
      });
    }

    // Notificações de erro sempre vão para super_admin também
    if (payload.type === 'error') {
      audiences.push({
        tenantId: null,
        userId: null
      });
    }

    return audiences;
  }
}