/**
 * CONTROLADOR DO MÓDULO SISTEMA - NESTJS
 *
 * Este controller define os endpoints da API REST para o módulo sistema.
 * Ele é registrado automaticamente pelo sistema de carregamento dinâmico.
 *
 * Todas as rotas deste controller estão protegidas por autenticação JWT
 * e controle de acesso baseado em papéis (roles).
 *
 * Rotas disponíveis:
 * - GET /api/sistema - Lista recursos do módulo
 * - GET /api/sistema/stats - Obtém estatísticas do módulo
 */

// Importações necessárias do NestJS e serviços do módulo
import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SistemaService } from '../services/sistema.service';
import { JwtAuthGuard } from '@core/guards/jwt-auth.guard';
import { RolesGuard } from '@core/guards/roles.guard';
import { Roles } from '@core/decorators/roles.decorator';
import { SendNotificationDto } from '../dto/sistema.dto';

/**
 * Decorators que aplicam guards de autenticação e autorização
 * a todas as rotas deste controller.
 *
 * JwtAuthGuard - Verifica se o usuário está autenticado via JWT
 * RolesGuard - Verifica se o usuário tem permissão para acessar a rota
 */
@Controller('api/sistema')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SistemaController {
  /**
   * Injeção de dependência do serviço do módulo
   * O serviço contém a lógica de negócio do módulo
   */
  constructor(private readonly sistemaService: SistemaService) { }

  /**
   * Endpoint para listar recursos do módulo sistema
   *
   * @param filters - Filtros opcionais para a consulta
   * @param req - Objeto de requisição contendo informações do usuário
   * @returns Lista de recursos do módulo
   */
  @Get()
  async findAll(@Query() filters: any, @Req() req) {
    // Extrai o ID do tenant do usuário autenticado
    const tenantId = req.user?.tenantId;
    // Chama o serviço para obter os dados
    return this.sistemaService.findAll(tenantId, filters);
  }

  /**
   * Endpoint para obter estatísticas do módulo sistema
   *
   * @param req - Objeto de requisição contendo informações do usuário
   * @returns Estatísticas do módulo
   */
  @Get('stats')
  async getStats(@Req() req) {
    // Extrai o ID do tenant do usuário autenticado
    const tenantId = req.user?.tenantId;
    // Chama o serviço para obter as estatísticas
    return this.sistemaService.getStats(tenantId);
  }

  /**
   * Endpoint para enviar notificações através do módulo sistema
   * Integrado ao sistema central de notificações
   *
   * @param dto - Dados da notificação
   * @param req - Objeto de requisição contendo informações do usuário
   * @returns Confirmação de envio
   */
  @Post('notificacoes/enviar')
  async enviarNotificacao(@Body() dto: SendNotificationDto, @Req() req) {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    
    console.log('📤 [SistemaController] Recebendo requisição:', {
      userId,
      tenantId,
      dto
    });
    
    try {
      const result = await this.sistemaService.enviarNotificacao(dto, userId, tenantId);
      console.log('✅ [SistemaController] Notificação enviada com sucesso');
      return result;
    } catch (error) {
      console.error('❌ [SistemaController] Erro ao enviar notificação:', error.message);
      throw error;
    }
  }
}