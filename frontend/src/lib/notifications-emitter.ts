/**
 * EMISSOR DE NOTIFICAÇÕES PARA MÓDULOS
 * 
 * Contrato oficial para módulos emitirem eventos de notificação
 * Garante formato consistente e validação
 */

import { notificationsService } from '@/services/notifications.service';
import { NotificationEvent } from '@/types/notifications';

export class NotificationsEmitter {
  private moduleName: string;
  private moduleVersion: string;
  private canEmitCritical: boolean;

  constructor(config: {
    moduleName: string;
    moduleVersion: string;
    canEmitCritical?: boolean;
  }) {
    this.moduleName = config.moduleName;
    this.moduleVersion = config.moduleVersion;
    this.canEmitCritical = config.canEmitCritical || false;
  }

  /**
   * Emite uma notificação informativa
   */
  async info(params: {
    type: string;
    title: string;
    message: string;
    tenantId?: string | null;
    userId?: string | null;
    context?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    await this.emit({
      ...params,
      severity: 'info'
    });
  }

  /**
   * Emite uma notificação de aviso
   */
  async warning(params: {
    type: string;
    title: string;
    message: string;
    tenantId?: string | null;
    userId?: string | null;
    context?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    await this.emit({
      ...params,
      severity: 'warning'
    });
  }

  /**
   * Emite uma notificação crítica (apenas se autorizado)
   */
  async critical(params: {
    type: string;
    title: string;
    message: string;
    tenantId?: string | null;
    userId?: string | null;
    context?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    if (!this.canEmitCritical) {
      console.warn(`❌ Módulo ${this.moduleName} não autorizado a emitir notificações críticas`);
      return;
    }

    await this.emit({
      ...params,
      severity: 'critical'
    });
  }

  /**
   * Emite evento de notificação (método interno)
   */
  private async emit(params: {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    tenantId?: string | null;
    userId?: string | null;
    context?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    // Validações
    this.validateEvent(params);

    // Monta evento
    const event: Omit<NotificationEvent, 'timestamp'> = {
      type: `${this.moduleName}.${params.type}`,
      source: 'module',
      module: this.moduleName,
      severity: params.severity,
      tenantId: params.tenantId,
      userId: params.userId,
      payload: {
        title: params.title,
        message: params.message,
        context: params.context,
        data: {
          ...params.data,
          moduleVersion: this.moduleVersion,
          emittedAt: new Date().toISOString()
        }
      }
    };

    try {
      await notificationsService.emitEvent(event);
      console.log(`✅ Notificação emitida: ${event.type} (${params.severity})`);
    } catch (error) {
      console.error(`❌ Erro ao emitir notificação ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Valida evento antes de emitir
   */
  private validateEvent(params: {
    type: string;
    severity: string;
    title: string;
    message: string;
  }): void {
    if (!params.type || typeof params.type !== 'string') {
      throw new Error('Tipo do evento é obrigatório e deve ser string');
    }

    if (!params.title || typeof params.title !== 'string') {
      throw new Error('Título é obrigatório e deve ser string');
    }

    if (!params.message || typeof params.message !== 'string') {
      throw new Error('Mensagem é obrigatória e deve ser string');
    }

    if (params.title.length > 100) {
      throw new Error('Título não pode ter mais de 100 caracteres');
    }

    if (params.message.length > 500) {
      throw new Error('Mensagem não pode ter mais de 500 caracteres');
    }

    // Valida caracteres especiais no tipo
    if (!/^[a-zA-Z0-9._-]+$/.test(params.type)) {
      throw new Error('Tipo do evento deve conter apenas letras, números, pontos, hífens e underscores');
    }
  }

  /**
   * Cria emissor para usuário específico
   */
  forUser(userId: string, tenantId?: string) {
    return {
      info: (params: Omit<Parameters<typeof this.info>[0], 'userId' | 'tenantId'>) =>
        this.info({ ...params, userId, tenantId }),
      
      warning: (params: Omit<Parameters<typeof this.warning>[0], 'userId' | 'tenantId'>) =>
        this.warning({ ...params, userId, tenantId }),
      
      critical: (params: Omit<Parameters<typeof this.critical>[0], 'userId' | 'tenantId'>) =>
        this.critical({ ...params, userId, tenantId })
    };
  }

  /**
   * Cria emissor para tenant específico
   */
  forTenant(tenantId: string) {
    return {
      info: (params: Omit<Parameters<typeof this.info>[0], 'tenantId'>) =>
        this.info({ ...params, tenantId }),
      
      warning: (params: Omit<Parameters<typeof this.warning>[0], 'tenantId'>) =>
        this.warning({ ...params, tenantId }),
      
      critical: (params: Omit<Parameters<typeof this.critical>[0], 'tenantId'>) =>
        this.critical({ ...params, tenantId })
    };
  }

  /**
   * Cria emissor para notificações globais (apenas super_admin)
   */
  global() {
    return {
      info: (params: Omit<Parameters<typeof this.info>[0], 'tenantId' | 'userId'>) =>
        this.info({ ...params, tenantId: null, userId: null }),
      
      warning: (params: Omit<Parameters<typeof this.warning>[0], 'tenantId' | 'userId'>) =>
        this.warning({ ...params, tenantId: null, userId: null }),
      
      critical: (params: Omit<Parameters<typeof this.critical>[0], 'tenantId' | 'userId'>) =>
        this.critical({ ...params, tenantId: null, userId: null })
    };
  }
}

/**
 * Factory para criar emissores de notificação para módulos
 */
export function createNotificationsEmitter(config: {
  moduleName: string;
  moduleVersion: string;
  canEmitCritical?: boolean;
}): NotificationsEmitter {
  return new NotificationsEmitter(config);
}

// ============================================================================
// EXEMPLOS DE USO PARA MÓDULOS
// ============================================================================

/**
 * Exemplo de uso em um módulo:
 * 
 * ```typescript
 * import { createNotificationsEmitter } from '@/lib/notifications-emitter';
 * 
 * const notifier = createNotificationsEmitter({
 *   moduleName: 'module-exemplo',
 *   moduleVersion: '1.0.0',
 *   canEmitCritical: false
 * });
 * 
 * // Notificação para usuário específico
 * await notifier.forUser('user123', 'tenant456').info({
 *   type: 'task_completed',
 *   title: 'Tarefa Concluída',
 *   message: 'Sua tarefa foi processada com sucesso',
 *   context: '/tasks/123',
 *   data: { taskId: '123', result: 'success' }
 * });
 * 
 * // Notificação para todo o tenant
 * await notifier.forTenant('tenant456').warning({
 *   type: 'integration_failed',
 *   title: 'Falha na Integração',
 *   message: 'A integração com o sistema externo falhou',
 *   context: '/integrations/settings'
 * });
 * 
 * // Notificação global (apenas super_admin verá)
 * await notifier.global().critical({
 *   type: 'module_error',
 *   title: 'Erro Crítico no Módulo',
 *   message: 'O módulo encontrou um erro crítico e precisa de atenção',
 *   data: { error: 'Database connection failed', stack: '...' }
 * });
 * ```
 */