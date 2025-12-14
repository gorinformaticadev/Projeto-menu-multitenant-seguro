/**
 * SISTEMA DE NOTIFICAÇÕES DO MODULE EXEMPLO
 * 
 * Demonstra como um módulo deve implementar notificações
 * usando o sistema centralizado
 */

import { createNotificationsEmitter } from '@/lib/notifications-emitter';

// Cria emissor para o módulo exemplo
export const moduleExemploNotifier = createNotificationsEmitter({
  moduleName: 'module-exemplo',
  moduleVersion: '1.0.0',
  canEmitCritical: false // Módulo exemplo não pode emitir críticas
});

// ============================================================================
// TIPOS DE NOTIFICAÇÃO DO MÓDULO EXEMPLO
// ============================================================================

export const ModuleExemploNotificationTypes = {
  // Notificações para usuários
  TASK_COMPLETED: 'task_completed',
  TASK_FAILED: 'task_failed',
  DATA_EXPORTED: 'data_exported',
  
  // Notificações para admins
  INTEGRATION_WARNING: 'integration_warning',
  QUOTA_EXCEEDED: 'quota_exceeded',
  
  // Notificações do sistema (para super_admin via core)
  MODULE_ERROR: 'module_error'
} as const;

// ============================================================================
// FUNÇÕES DE NOTIFICAÇÃO ESPECÍFICAS
// ============================================================================

/**
 * Notifica conclusão de tarefa para usuário
 */
export async function notifyTaskCompleted(params: {
  userId: string;
  tenantId: string;
  taskId: string;
  taskName: string;
  result?: any;
}) {
  await moduleExemploNotifier.forUser(params.userId, params.tenantId).info({
    type: ModuleExemploNotificationTypes.TASK_COMPLETED,
    title: 'Tarefa Concluída',
    message: `A tarefa "${params.taskName}" foi processada com sucesso.`,
    context: `/module-exemplo/tasks/${params.taskId}`,
    data: {
      taskId: params.taskId,
      taskName: params.taskName,
      result: params.result
    }
  });
}

/**
 * Notifica falha em tarefa para usuário
 */
export async function notifyTaskFailed(params: {
  userId: string;
  tenantId: string;
  taskId: string;
  taskName: string;
  error: string;
}) {
  await moduleExemploNotifier.forUser(params.userId, params.tenantId).warning({
    type: ModuleExemploNotificationTypes.TASK_FAILED,
    title: 'Falha na Tarefa',
    message: `A tarefa "${params.taskName}" falhou: ${params.error}`,
    context: `/module-exemplo/tasks/${params.taskId}`,
    data: {
      taskId: params.taskId,
      taskName: params.taskName,
      error: params.error
    }
  });
}

/**
 * Notifica exportação de dados concluída
 */
export async function notifyDataExported(params: {
  userId: string;
  tenantId: string;
  exportId: string;
  fileName: string;
  recordCount: number;
}) {
  await moduleExemploNotifier.forUser(params.userId, params.tenantId).info({
    type: ModuleExemploNotificationTypes.DATA_EXPORTED,
    title: 'Exportação Concluída',
    message: `Arquivo "${params.fileName}" exportado com ${params.recordCount} registros.`,
    context: `/module-exemplo/exports/${params.exportId}`,
    data: {
      exportId: params.exportId,
      fileName: params.fileName,
      recordCount: params.recordCount
    }
  });
}

/**
 * Notifica aviso de integração para admins do tenant
 */
export async function notifyIntegrationWarning(params: {
  tenantId: string;
  integration: string;
  warning: string;
}) {
  await moduleExemploNotifier.forTenant(params.tenantId).warning({
    type: ModuleExemploNotificationTypes.INTEGRATION_WARNING,
    title: 'Aviso de Integração',
    message: `Integração ${params.integration}: ${params.warning}`,
    context: `/module-exemplo/integrations`,
    data: {
      integration: params.integration,
      warning: params.warning
    }
  });
}

/**
 * Notifica cota excedida para admins do tenant
 */
export async function notifyQuotaExceeded(params: {
  tenantId: string;
  quotaType: string;
  currentUsage: number;
  limit: number;
}) {
  await moduleExemploNotifier.forTenant(params.tenantId).warning({
    type: ModuleExemploNotificationTypes.QUOTA_EXCEEDED,
    title: 'Cota Excedida',
    message: `Cota de ${params.quotaType} excedida: ${params.currentUsage}/${params.limit}`,
    context: `/module-exemplo/settings/quotas`,
    data: {
      quotaType: params.quotaType,
      currentUsage: params.currentUsage,
      limit: params.limit
    }
  });
}

// ============================================================================
// EXEMPLO DE USO EM COMPONENTES DO MÓDULO
// ============================================================================

/**
 * Exemplo de como usar em um componente React:
 * 
 * ```typescript
 * import { notifyTaskCompleted } from './notifications';
 * 
 * const handleTaskSubmit = async () => {
 *   try {
 *     const result = await processTask(taskData);
 *     
 *     // Notifica sucesso
 *     await notifyTaskCompleted({
 *       userId: user.id,
 *       tenantId: user.tenantId,
 *       taskId: result.id,
 *       taskName: taskData.name,
 *       result: result.data
 *     });
 *     
 *   } catch (error) {
 *     // Notifica falha
 *     await notifyTaskFailed({
 *       userId: user.id,
 *       tenantId: user.tenantId,
 *       taskId: taskData.id,
 *       taskName: taskData.name,
 *       error: error.message
 *     });
 *   }
 * };
 * ```
 */

// ============================================================================
// INTEGRAÇÃO COM BACKEND
// ============================================================================

/**
 * Para integração com backend, o módulo deve:
 * 
 * 1. Emitir eventos via API quando ações importantes acontecem
 * 2. O backend processa e cria notificações baseado nas regras de audiência
 * 3. Frontend recebe via polling e exibe nas interfaces
 * 
 * Exemplo de chamada para backend:
 * 
 * ```typescript
 * // No service do módulo
 * export async function completeTask(taskId: string) {
 *   const result = await api.post(`/module-exemplo/tasks/${taskId}/complete`);
 *   
 *   // Backend automaticamente emite notificação baseado no resultado
 *   // Não precisa emitir manualmente no frontend
 *   
 *   return result.data;
 * }
 * ```
 */