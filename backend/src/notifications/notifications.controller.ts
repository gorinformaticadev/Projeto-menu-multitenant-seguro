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
} from '@nestjs/common';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { NotificationsService, NotificationEvent, NotificationFilters } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * Emite um evento de notificaÃ§Ã£o
   */
  @Post('events')
  async emitEvent(@Body() event: NotificationEvent, @Request() req) {
    await this.notificationsService.emitEvent(event, req.user);
    return { success: true };
  }

  /**
   * Busca notificaÃ§Ãµes para o dropdown
   */
  @Get('dropdown')
  async getDropdownNotifications(@Request() req) {
    return this.notificationsService.getDropdownNotifications(req.user);
  }

  /**
   * Busca notificaÃ§Ãµes para a central
   */
  @Get('center')
  async getCenterNotifications(@Query() query: any, @Request() req) {
    const filters: NotificationFilters = {
      severity: query.severity,
      source: query.source,
      module: query.module,
      tenantId: query.tenantId,
      read: query.read === 'true' ? true : query.read === 'false' ? false : undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    return this.notificationsService.getCenterNotifications(req.user, filters);
  }

  /**
   * Busca contagem de nÃ£o lidas
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.notificationsService.getUnreadCount(req.user);
    return { count };
  }

  /**
   * Marca notificaÃ§Ã£o como lida
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    await this.notificationsService.markAsRead(id, req.user);
    return { success: true };
  }

  /**
   * Marca todas as notificaÃ§Ãµes como lidas
   */
  @Patch('mark-all-read')
  async markAllAsRead(@Body() body: { filters?: NotificationFilters }, @Request() req) {
    await this.notificationsService.markAllAsRead(req.user, body.filters);
    return { success: true };
  }

  /**
   * Deleta notificaÃ§Ã£o
   */
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req) {
    await this.notificationsService.deleteNotification(id, req.user);
    return { success: true };
  }

  /**
   * Deleta notificaÃ§Ãµes em lote
   */
  @Delete('batch')
  async deleteNotifications(@Body() body: { ids: string[] }, @Request() req) {
    await this.notificationsService.deleteNotifications(body.ids, req.user);
    return { success: true };
  }
}
