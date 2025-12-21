/**
 * NOTIFICATION CONTROLLER - Endpoints de notificações + SSE
 * 
 * Substitui o controller antigo mantendo compatibilidade
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Response,
  Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { NotificationCore } from './notification.core';
import { NotificationStore } from './notification.store';
import { NotificationBus } from './notification.bus';
import { RealtimeBus } from '../realtime/realtime.bus';
import { NotificationPayload, NotificationFilters } from './notification.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private notificationCore: NotificationCore,
    private notificationStore: NotificationStore,
    private notificationBus: NotificationBus,
    private realtimeBus: RealtimeBus
  ) {}

  /**
   * ENDPOINT SSE - Server-Sent Events para notificações em tempo real
   */
  @Get('sse')
  async subscribeSSE(@Request() req, @Response() res) {
    const user = req.user;
    const connectionId = `sse_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`Nova conexão SSE: ${connectionId} (user: ${user.id}, tenant: ${user.tenantId})`);

    // Registra conexão SSE no RealtimeBus
    this.realtimeBus.registerSSEConnection(connectionId, res, user.tenantId, user.id);

    // Não retorna nada - a conexão fica aberta
  }

  /**
   * Emite notificação (API pública do NotificationCore)
   */
  @Post('notify')
  async notify(@Body() payload: NotificationPayload, @Request() req) {
    await this.notificationCore.notify(payload);
    return { success: true };
  }

  /**
   * Busca notificações para o dropdown (compatibilidade)
   */
  @Get('dropdown')
  async getDropdownNotifications(@Request() req) {
    const response = await this.notificationStore.findForDropdown(req.user);
    return {
      notifications: response.notifications,
      total: response.total,
      unreadCount: response.unreadCount,
      hasMore: response.hasMore
    };
  }

  /**
   * Busca notificações para a central (compatibilidade)
   */
  @Get('center')
  async getCenterNotifications(@Query() query: any, @Request() req) {
    const filters: NotificationFilters = {
      type: query.severity,
      origin: query.source,
      module: query.module,
      tenantId: query.tenantId,
      read: query.read === 'true' ? true : query.read === 'false' ? false : undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    const response = await this.notificationStore.findMany(req.user, filters);
    return {
      notifications: response.notifications,
      total: response.total,
      unreadCount: response.unreadCount,
      hasMore: response.hasMore
    };
  }

  /**
   * Busca contagem de não lidas (compatibilidade)
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.notificationStore.countUnread(req.user);
    return { count };
  }

  /**
   * Marca notificação como lida
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationBus.processMarkAsRead(id, req.user);
    
    if (!notification) {
      return { success: false, message: 'Notificação não encontrada ou sem permissão' };
    }

    return { success: true };
  }

  /**
   * Marca todas as notificações como lidas
   */
  @Patch('mark-all-read')
  async markAllAsRead(@Body() body: { filters?: NotificationFilters }, @Request() req) {
    const count = await this.notificationStore.markAllAsRead(req.user, body.filters);
    return { success: true, count };
  }

  /**
   * Deleta notificação
   */
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationBus.processDelete(id, req.user);
    
    if (!notification) {
      return { success: false, message: 'Notificação não encontrada ou sem permissão' };
    }

    return { success: true };
  }

  /**
   * Deleta notificações em lote
   */
  @Delete('batch')
  async deleteNotifications(@Body() body: { ids: string[] }, @Request() req) {
    const count = await this.notificationStore.deleteMany(body.ids, req.user);
    return { success: true, count };
  }

  /**
   * Endpoint para teste de atraso (conforme especificação)
   */
  @Post('test-delay')
  async testDelay(@Body() payload: NotificationPayload) {
    this.logger.log('Iniciando teste de atraso de 25 segundos...');
    
    // Emite notificação IMEDIATAMENTE
    await this.notificationCore.notify(payload);
    
    // Simula atraso conforme especificação
    await new Promise(r => setTimeout(r, 25000));
    
    this.logger.log('Teste de atraso concluído - notificação deve ter chegado imediatamente');
    return { success: true, message: 'Teste concluído' };
  }

  /**
   * Endpoint para estatísticas de conexões SSE
   */
  @Get('sse/stats')
  async getSSEStats() {
    return this.realtimeBus.getConnectionStats();
  }

  // ============================================================================
  // ENDPOINTS DE COMPATIBILIDADE COM SISTEMA ANTIGO
  // ============================================================================

  /**
   * Emite evento (compatibilidade com sistema antigo)
   */
  @Post('events')
  async emitEvent(@Body() event: any, @Request() req) {
    // Converte evento antigo para novo formato
    await this.notificationCore.notifyLegacy({
      tenantId: event.tenantId,
      userId: event.userId,
      title: event.payload.title,
      description: event.payload.message,
      severity: event.severity,
      source: event.source,
      module: event.module,
      context: event.payload.context,
      data: event.payload.data
    });

    return { success: true };
  }
}