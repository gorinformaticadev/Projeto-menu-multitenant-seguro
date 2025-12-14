/**
 * SERVIÇO DE NOTIFICAÇÕES
 * 
 * Responsável por toda comunicação com o backend
 * Implementa regras de audiência e filtros
 */

import api from '@/lib/api';
import { 
  Notification, 
  NotificationEvent, 
  NotificationFilters, 
  NotificationResponse 
} from '@/types/notifications';

class NotificationsService {
  private baseUrl = '/notifications';

  // ============================================================================
  // EMISSÃO DE EVENTOS (Para Core e Módulos)
  // ============================================================================

  /**
   * Emite um evento de notificação
   * O backend processará e criará as notificações apropriadas
   */
  async emitEvent(event: Omit<NotificationEvent, 'timestamp'>): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/events`, {
        ...event,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Erro ao emitir evento de notificação:', error);
      throw error;
    }
  }

  // ============================================================================
  // CONSULTA DE NOTIFICAÇÕES (Para UI)
  // ============================================================================

  /**
   * Busca notificações para o dropdown (últimas 15)
   */
  async getDropdownNotifications(): Promise<NotificationResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/dropdown`);
      return {
        notifications: response.data.notifications.map(this.parseNotification),
        total: response.data.total,
        unreadCount: response.data.unreadCount,
        hasMore: response.data.hasMore
      };
    } catch (error) {
      console.error('❌ Erro ao buscar notificações do dropdown:', error);
      throw error;
    }
  }

  /**
   * Busca notificações para a central (paginadas e filtradas)
   */
  async getCenterNotifications(filters: NotificationFilters = {}): Promise<NotificationResponse> {
    try {
      const params = new URLSearchParams();
      
      // Aplicar filtros
      if (filters.severity && filters.severity !== 'all') {
        params.append('severity', filters.severity);
      }
      if (filters.source && filters.source !== 'all') {
        params.append('source', filters.source);
      }
      if (filters.module) {
        params.append('module', filters.module);
      }
      if (filters.tenantId) {
        params.append('tenantId', filters.tenantId);
      }
      if (filters.read !== undefined) {
        params.append('read', filters.read.toString());
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo.toISOString());
      }
      
      // Paginação
      params.append('page', (filters.page || 1).toString());
      params.append('limit', (filters.limit || 20).toString());

      const response = await api.get(`${this.baseUrl}/center?${params.toString()}`);
      
      return {
        notifications: response.data.notifications.map(this.parseNotification),
        total: response.data.total,
        unreadCount: response.data.unreadCount,
        hasMore: response.data.hasMore
      };
    } catch (error) {
      console.error('❌ Erro ao buscar notificações da central:', error);
      throw error;
    }
  }

  /**
   * Busca contagem de não lidas
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await api.get(`${this.baseUrl}/unread-count`);
      return response.data.count;
    } catch (error) {
      console.error('❌ Erro ao buscar contagem de não lidas:', error);
      return 0;
    }
  }

  // ============================================================================
  // AÇÕES DE NOTIFICAÇÕES
  // ============================================================================

  /**
   * Marca uma notificação como lida
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await api.patch(`${this.baseUrl}/${notificationId}/read`);
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      throw error;
    }
  }

  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead(filters?: Partial<NotificationFilters>): Promise<void> {
    try {
      await api.patch(`${this.baseUrl}/mark-all-read`, { filters });
    } catch (error) {
      console.error('❌ Erro ao marcar todas como lidas:', error);
      throw error;
    }
  }

  /**
   * Deleta uma notificação
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${notificationId}`);
    } catch (error) {
      console.error('❌ Erro ao deletar notificação:', error);
      throw error;
    }
  }

  /**
   * Deleta notificações em lote
   */
  async deleteNotifications(notificationIds: string[]): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/batch`, {
        data: { ids: notificationIds }
      });
    } catch (error) {
      console.error('❌ Erro ao deletar notificações em lote:', error);
      throw error;
    }
  }

  // ============================================================================
  // ADMIN/SUPER_ADMIN - GESTÃO
  // ============================================================================

  /**
   * Busca estatísticas de notificações (apenas admin/super)
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    bySource: Record<string, number>;
    bySeverity: Record<string, number>;
    byModule: Record<string, number>;
    recentTrends: Array<{ date: string; count: number }>;
  }> {
    try {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      const response = await api.get(`${this.baseUrl}/statistics${params}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Busca lista de tenants com notificações (apenas super_admin)
   */
  async getTenantsWithNotifications(): Promise<Array<{
    tenantId: string;
    tenantName: string;
    unreadCount: number;
    criticalCount: number;
  }>> {
    try {
      const response = await api.get(`${this.baseUrl}/tenants`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar tenants:', error);
      throw error;
    }
  }

  /**
   * Busca módulos ativos com notificações
   */
  async getModulesWithNotifications(tenantId?: string): Promise<Array<{
    module: string;
    count: number;
    criticalCount: number;
  }>> {
    try {
      const params = tenantId ? `?tenantId=${tenantId}` : '';
      const response = await api.get(`${this.baseUrl}/modules${params}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar módulos:', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  /**
   * Converte notificação do backend para o formato do frontend
   */
  private parseNotification(raw: any): Notification {
    return {
      id: raw.id,
      title: raw.title,
      message: raw.message,
      severity: raw.severity,
      audience: raw.audience,
      source: raw.source,
      module: raw.module,
      tenantId: raw.tenantId,
      userId: raw.userId,
      context: raw.context,
      data: raw.data,
      read: raw.read,
      createdAt: new Date(raw.createdAt),
      readAt: raw.readAt ? new Date(raw.readAt) : undefined
    };
  }

  /**
   * Valida se o usuário pode ver uma notificação
   * (Validação adicional no frontend, backend já filtra)
   */
  canUserSeeNotification(notification: Notification, userRole: string, userId: string, tenantId?: string): boolean {
    // Usuário comum: apenas suas próprias notificações não críticas
    if (userRole === 'USER') {
      return notification.audience === 'user' && 
             notification.userId === userId &&
             notification.severity !== 'critical';
    }

    // Admin: notificações do tenant
    if (userRole === 'ADMIN') {
      return notification.tenantId === tenantId &&
             (notification.audience === 'admin' || notification.audience === 'user');
    }

    // Super Admin: todas
    if (userRole === 'SUPER_ADMIN') {
      return true;
    }

    return false;
  }
}

// Exporta instância singleton
export const notificationsService = new NotificationsService();