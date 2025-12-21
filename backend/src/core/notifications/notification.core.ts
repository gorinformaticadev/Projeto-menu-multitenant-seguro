/**
 * NOTIFICATION CORE - API Pública do Sistema de Notificações
 * 
 * Interface única para emissão de notificações (notify())
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotificationPayload } from './notification.types';
import { NotificationBus } from './notification.bus';

@Injectable()
export class NotificationCore {
  private readonly logger = new Logger(NotificationCore.name);

  constructor(private notificationBus: NotificationBus) {}

  /**
   * API PÚBLICA: notify() - Interface única para todas as notificações
   * 
   * @param payload Dados da notificação seguindo o contrato único
   * @returns Promise<void> - Resolve imediatamente após SSE, persistência em background
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const startTime = Date.now();

    try {
      // Validação do payload
      this.validatePayload(payload);

      // Log da notificação
      this.logger.log(`Notificação recebida: ${payload.title} (${payload.type}) - Origem: ${payload.origin}`);

      // Processa via NotificationBus (SSE + persistência)
      await this.notificationBus.processNotification(payload);

      const duration = Date.now() - startTime;
      this.logger.log(`Notificação processada em ${duration}ms: ${payload.title}`);

    } catch (error) {
      this.logger.error(`Erro ao processar notificação: ${payload.title}`, error);
      throw error;
    }
  }

  /**
   * Método de conveniência para notificações do sistema
   */
  async notifySystem(params: {
    tenantId?: string | null;
    userId?: string | null;
    title: string;
    description: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    entityId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const payload: NotificationPayload = {
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title,
      description: params.description,
      type: params.type || 'info',
      origin: 'system',
      permissions: {
        canRead: true,
        canDelete: true
      },
      metadata: {
        module: 'system',
        entityId: params.entityId,
        ...params.metadata
      }
    };

    await this.notify(payload);
  }

  /**
   * Método de conveniência para notificações de módulos
   */
  async notifyModule(params: {
    module: string;
    tenantId?: string | null;
    userId?: string | null;
    title: string;
    description: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    entityId?: string;
    metadata?: Record<string, any>;
    permissions?: {
      canRead?: boolean;
      canDelete?: boolean;
    };
  }): Promise<void> {
    const payload: NotificationPayload = {
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title,
      description: params.description,
      type: params.type || 'info',
      origin: 'modules',
      permissions: {
        canRead: params.permissions?.canRead ?? true,
        canDelete: params.permissions?.canDelete ?? true
      },
      metadata: {
        module: params.module,
        entityId: params.entityId,
        ...params.metadata
      }
    };

    await this.notify(payload);
  }

  /**
   * Método para migrar notificações antigas (compatibilidade)
   */
  async notifyLegacy(params: {
    tenantId?: string | null;
    userId?: string | null;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    source: 'core' | 'module';
    module?: string;
    context?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const payload: NotificationPayload = {
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title,
      description: params.description,
      type: params.severity === 'critical' ? 'error' : params.severity as any,
      origin: params.source === 'core' ? 'system' : 'modules',
      permissions: {
        canRead: true,
        canDelete: true
      },
      metadata: {
        module: params.module || 'system',
        entityId: params.context,
        legacy: true,
        ...params.data
      }
    };

    await this.notify(payload);
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  private validatePayload(payload: NotificationPayload): void {
    if (!payload.title || payload.title.trim().length === 0) {
      throw new Error('Título da notificação é obrigatório');
    }

    if (!payload.description || payload.description.trim().length === 0) {
      throw new Error('Descrição da notificação é obrigatória');
    }

    if (payload.title.length > 100) {
      throw new Error('Título não pode ter mais de 100 caracteres');
    }

    if (payload.description.length > 500) {
      throw new Error('Descrição não pode ter mais de 500 caracteres');
    }

    if (!['info', 'success', 'warning', 'error'].includes(payload.type)) {
      throw new Error('Tipo de notificação inválido');
    }

    if (!['system', 'modules', 'orders'].includes(payload.origin)) {
      throw new Error('Origem da notificação inválida');
    }

    if (!payload.metadata.module || payload.metadata.module.trim().length === 0) {
      throw new Error('Módulo da notificação é obrigatório');
    }
  }
}