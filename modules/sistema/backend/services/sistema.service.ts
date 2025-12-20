/**
 * SERVIÇO DO MÓDULO SISTEMA - NESTJS
 *
 * Este serviço contém a lógica de negócio do módulo sistema.
 * Ele é injetado no controller para processar as requisições.
 *
 * Métodos disponíveis:
 * - findAll - Obtém todos os recursos do módulo
 * - getStats - Obtém estatísticas do módulo
 * - enviarNotificacao - Envia notificação integrada ao sistema central
 */

// Importação necessária do decorator Injectable do NestJS
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { NotificationService } from '@core/notification.service';
import { SendNotificationDto } from '../dto/sistema.dto';

/**
 * Decorator que marca a classe como injetável pelo NestJS
 * Permite que o serviço seja injetado em controllers e outros serviços
 */
@Injectable()
export class SistemaService {
  /**
   * Injeção do NotificationService do CORE
   * Usado para integrar com o sistema central de notificações
   */
  constructor(private readonly notificationService: NotificationService) {}
  /**
   * Método para obter todos os recursos do módulo sistema
   *
   * @param tenantId - ID do tenant atual (para isolamento de dados)
   * @param filters - Filtros opcionais para a consulta
   * @returns Objeto com os dados dos recursos
   */
  async findAll(tenantId: string, filters: any) {
    // Implementação simples - deve ser substituída pela lógica real
    return {
      success: true,
      data: [],
      message: 'Módulo sistema funcionando'
    };
  }

  /**
   * Método para obter estatísticas do módulo sistema
   *
   * @param tenantId - ID do tenant atual (para isolamento de dados)
   * @returns Objeto com as estatísticas do módulo
   */
  async getStats(tenantId: string) {
    return {
      success: true,
      data: {
        module: 'sistema',
        version: '1.0.1',
        status: 'active'
      }
    };
  }

  /**
   * [REGRA 1] Envia notificação usando o sistema central de notificações COM SSE IMEDIATO
   * Integrado ao NotificationService do CORE
   *
   * @param dto - Dados da notificação
   * @param userId - ID do usuário que está enviando
   * @param tenantId - ID do tenant atual
   * @returns Confirmação de envio
   */
  async enviarNotificacao(dto: SendNotificationDto, userId: string, tenantId: string) {
    const timestamp1 = Date.now();
    console.log(`[${timestamp1}] [1] Clique em enviar detectado - Módulo Sistema`);

    // Validações
    if (!dto.titulo || dto.titulo.length > 100) {
      throw new BadRequestException('Título é obrigatório e deve ter no máximo 100 caracteres');
    }

    if (!dto.mensagem || dto.mensagem.length > 500) {
      throw new BadRequestException('Mensagem é obrigatória e deve ter no máximo 500 caracteres');
    }

    // Mapeia tipo para severity
    const severityMap = {
      'info': 'info' as const,
      'success': 'info' as const,
      'warning': 'warning' as const,
      'error': 'critical' as const
    };

    const severity = dto.critica ? 'critical' as const : severityMap[dto.tipo];

    // Determina tenantId baseado no destino
    const targetTenantId = dto.destino === 'todos_tenants' ? null : tenantId;

    // [REGRA 1] Cria notificação usando o serviço do CORE (que emite SSE IMEDIATO)
    const timestamp2 = Date.now();
    console.log(`[${timestamp2}] [2] Chamando NotificationService.createNotification - SSE será emitido ANTES do banco`);
    
    await this.notificationService.createNotification({
      title: dto.titulo,
      message: dto.mensagem,
      severity: severity,
      audience: 'admin', // Notificações do módulo sistema vão para admins
      source: 'module',
      module: 'sistema',
      tenantId: targetTenantId,
      context: '/modules/sistema/notificacao',
      data: {
        tipo: dto.tipo,
        critica: dto.critica,
        destino: dto.destino,
        enviadoPor: userId,
        timestamp: timestamp1
      }
    });

    const timestamp3 = Date.now();
    console.log(`[${timestamp3}] [3] Notificação processada - Tempo total: ${timestamp3 - timestamp1}ms`);
    console.log(`[${timestamp3}] ✅ FLUXO CORRETO: SSE emitido ANTES da persistência no banco`);

    return {
      success: true,
      message: 'Notificação enviada com sucesso via SSE',
      timestamp: timestamp3,
      latency: `${timestamp3 - timestamp1}ms`
    };
  }
}