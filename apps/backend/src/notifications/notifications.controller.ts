/**
 * NOTIFICATIONS CONTROLLER - Endpoints REST para notificações
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
} from '@nestjs/common';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { CreateNotificationDto, NotificationFiltersDto } from './notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private notificationService: NotificationService,
    private notificationGateway: NotificationGateway
  ) { }

  /**
   * Cria uma nova notificação
   */
  @Post()
  async create(@Body() createDto: CreateNotificationDto, @Request() req) {
    const notification = await this.notificationService.create(createDto);

    // Emite via Socket.IO
    await this.notificationGateway.emitNewNotification(notification);

    return { success: true, notification };
  }

  /**
   * Busca notificações para o dropdown (últimas 10)
   */
  @Get('dropdown')
  async getDropdown(@Request() req) {
    return this.notificationService.findForDropdown(req.user);
  }

  /**
   * Busca notificações com filtros e paginação
   */
  @Get()
  async findMany(@Query() query: NotificationFiltersDto, @Request() req) {
    const filters = {
      type: query.type,
      read: query.read,
      tenantId: query.tenantId,
      userId: query.userId,
      dateFrom: query.dateFrom && query.dateFrom !== 'undefined' ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo && query.dateTo !== 'undefined' ? new Date(query.dateTo) : undefined,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    };

    return this.notificationService.findMany(req.user, filters);
  }

  /**
   * Conta notificações não lidas
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.notificationService.countUnread(req.user);
    return { count };
  }

  /**
   * Marca notificação como lida
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationService.markAsRead(id, req.user);

    if (notification) {
      // Emite evento via Socket.IO
      await this.notificationGateway.emitNotificationRead(notification);
    }

    return { success: !!notification };
  }

  /**
   * Marca notificação como NÃO lida
   */
  @Patch(':id/unread')
  async markAsUnread(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationService.markAsUnread(id, req.user);

    // Não emite socket conforme regra de isolamento da lista

    return { success: !!notification };
  }

  /**
   * Marca todas as notificações como lidas
   */
  @Patch('mark-all-read')
  async markAllAsRead(@Request() req) {
    const count = await this.notificationService.markAllAsRead(req.user);
    return { success: true, count };
  }

  /**
   * Deleta múltiplas notificações
   */
  @Delete('batch')
  async deleteMany(@Body() body: { ids: string[] }, @Request() req) {
    try {
      console.log('🗑️ [Batch Delete] IDs recebidos:', body);

      let idsToDelete = body.ids;
      if (!Array.isArray(idsToDelete) && typeof idsToDelete === 'object') {
        idsToDelete = Object.values(idsToDelete);
      }

      const count = await this.notificationService.deleteMany(idsToDelete, req.user);
      return { success: true, count };
    } catch (e) {
      console.error('❌ ERRO [Batch Delete]:', e);
      throw e;
    }
  }

  /**
   * Deleta uma notificação
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationService.delete(id, req.user);

    if (notification) {
      // Emite evento via Socket.IO
      await this.notificationGateway.emitNotificationDeleted(id, notification);
    }

    return { success: !!notification };
  }
}