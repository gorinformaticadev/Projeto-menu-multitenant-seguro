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
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { PushNotificationService } from './push-notification.service';
import {
  CreateNotificationDto,
  NotificationFiltersDto,
  BroadcastNotificationDto,
  SavePushSubscriptionDto,
  RemovePushSubscriptionDto,
  BroadcastNotificationResponseDto,
  CreateNotificationResponseDto,
  TestPushNotificationDto,
  TestPushNotificationResponseDto,
  TestPushNotificationResultItem,
} from './notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private notificationService: NotificationService,
    private notificationGateway: NotificationGateway,
    private pushNotificationService: PushNotificationService,
  ) {}

  @Get('push/public-key')
  async getPushPublicKey() {
    const publicKey = await this.pushNotificationService.getPublicKey();
    return {
      enabled: !!publicKey,
      publicKey,
    };
  }

  @Post('push/subscribe')
  async subscribeToPush(@Body() body: SavePushSubscriptionDto, @Request() req) {
    const userAgentHeader = req.headers?.['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    const success = await this.pushNotificationService.saveSubscription(
      req.user,
      body,
      userAgent,
    );

    return { success };
  }

  @Post('push/unsubscribe')
  async unsubscribeFromPush(@Body() body: RemovePushSubscriptionDto, @Request() req) {
    const count = await this.pushNotificationService.removeSubscription(req.user, body.endpoint);
    return { success: count > 0, count };
  }

  /**
   * Cria uma nova notificação
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async create(@Body() createDto: CreateNotificationDto, @Request() req): Promise<CreateNotificationResponseDto> {
    const configuration = await this.notificationService.getNotificationsToggleState();
    if (!configuration.enabled) {
      return {
        success: true,
        notification: null,
        suppressed: true,
        blockReason: 'disabled_by_configuration',
        configuration,
      };
    }

    const notification = await this.notificationService.create(createDto, req.user);

    if (notification) {
      // Emite via Socket.IO
      await this.notificationGateway.emitNewNotification(notification);
    }

    return {
      success: true,
      notification,
      suppressed: false,
      blockReason: null,
      configuration,
    };
  }

  /**
   * Envia notificação em massa (Broadcast)
   */
  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async broadcast(@Body() body: BroadcastNotificationDto, @Request() req): Promise<BroadcastNotificationResponseDto> {
    const configuration = await this.notificationService.getNotificationsToggleState();
    if (!configuration.enabled) {
      return {
        count: 0,
        suppressed: true,
        blockReason: 'disabled_by_configuration',
        configuration,
      };
    }

    const result = await this.notificationService.broadcast(body, req.user);

    return {
      ...result,
      suppressed: false,
      blockReason: null,
      configuration,
    };
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
    const notification = await this.notificationService.markUserNotificationAsRead(id, req.user);

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
   * Deleta múltiplas notificações (Via POST para garantir envio do body)
   */
  @Post('batch-delete')
  async deleteMany(@Body() body: { ids: string[] }, @Request() req) {
    try {
      let idsToDelete = body.ids;

      // Sanitização robusta para garantir array puro de strings
      if (Array.isArray(idsToDelete)) {
        idsToDelete = [...idsToDelete]; // Clone para remover propriedades estranhas de Proxy se houver
      } else if (typeof idsToDelete === 'object' && idsToDelete !== null) {
        // Converte objeto {0: 'a', 1: 'b'} para array
        idsToDelete = Object.values(idsToDelete).filter(i => typeof i === 'string');
      } else {
        idsToDelete = [];
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

  /**
   * Lista grupos de notificações agrupadas
   */
  @Get('grouped')
  async getGrouped(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req,
  ) {
    return this.notificationService.listGroups(req.user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Lista notificações individuais de um grupo
   */
  @Get('groups/:groupId/items')
  async getGroupItems(
    @Param('groupId') groupId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req,
  ) {
    return this.notificationService.listGroupItems(groupId, req.user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Marca todas as notificações de um grupo como lidas
   */
  @Patch('groups/:groupId/read-all')
  async markGroupAsRead(@Param('groupId') groupId: string, @Request() req) {
    const count = await this.notificationService.markGroupAsRead(groupId, req.user);
    return { success: true, count };
  }

  /**
   * Endpoint de teste de notificações push
   */
  @Post('test-push')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async testPush(@Body() dto: TestPushNotificationDto, @Request() req): Promise<TestPushNotificationResponseDto> {
    const user = req.user;
    const repeat = Math.max(1, Math.min(10, dto.repeat ?? 1));
    const delayMs = Math.max(0, Math.min(2000, dto.delayMs ?? 0));

    if (dto.mode === 'module' && !dto.module?.trim()) {
      return {
        success: false,
        mode: dto.mode,
        repeatRequested: repeat,
        repeatSucceeded: 0,
        repeatFailed: repeat,
        targetUserId: user.id,
        tenantId: user.tenantId ?? null,
        generatedScopeSummary: 'module: (missing)',
        results: Array.from({ length: repeat }, (_, i) => ({
          index: i,
          success: false,
          error: 'module é obrigatório quando mode = "module"',
        })),
      };
    }

    const targetUserId = user.id;
    const tenantId = user.tenantId ?? null;

    if (dto.mode === 'self') {
      const subCount = await this.pushNotificationService.countUserSubscriptions(targetUserId);
      if (subCount === 0) {
        return {
          success: false,
          mode: dto.mode,
          repeatRequested: repeat,
          repeatSucceeded: 0,
          repeatFailed: repeat,
          targetUserId,
          tenantId,
          generatedScopeSummary: 'self: no subscription',
          results: [{
            index: 0,
            success: false,
            error: 'Nenhuma PushSubscription ativa encontrada para este usuário. Registre uma subscription primeiro.',
          }],
        };
      }
    }

    const scopeType = dto.mode === 'module' ? 'module' : 'system';
    const scopeKey = dto.mode === 'module' ? dto.module!.trim() : 'general';
    const generatedScopeSummary = `${scopeType}:${scopeKey}`;

    const metadata: Record<string, unknown> = {
      test: true,
      origin: 'push-test-panel',
      requestedMode: dto.mode,
      requestedAt: new Date().toISOString(),
      ...(dto.extraData || {}),
    };

    if (dto.mode === 'module' && dto.module) {
      metadata.module = dto.module.trim();
    }

    const severityMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
      info: 'info',
      success: 'success',
      warning: 'warning',
      error: 'error',
    };

    const results: TestPushNotificationResultItem[] = [];
    let repeatSucceeded = 0;
    let repeatFailed = 0;

    for (let i = 0; i < repeat; i++) {
      if (i > 0 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        const itemMetadata = { ...metadata, repeatIndex: i };

        const createDto: CreateNotificationDto = {
          title: dto.title,
          description: dto.message,
          type: severityMap[dto.severity] || 'info',
          userId: targetUserId,
          tenantId: tenantId || undefined,
          metadata: itemMetadata,
        };

        const notification = await this.notificationService.create(createDto, user);

        if (!notification) {
          results.push({ index: i, success: false, error: 'Falha ao criar notificação (serviço pode estar desabilitado)' });
          repeatFailed++;
          continue;
        }

        await this.notificationGateway.emitNewNotification(notification, { push: true });

        results.push({
          index: i,
          success: true,
          notificationId: notification.id,
          scopeType,
          scopeKey,
        });
        repeatSucceeded++;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        results.push({ index: i, success: false, error: errMsg });
        repeatFailed++;
      }
    }

    return {
      success: repeatSucceeded > 0,
      mode: dto.mode,
      repeatRequested: repeat,
      repeatSucceeded,
      repeatFailed,
      targetUserId,
      tenantId,
      generatedScopeSummary,
      results,
    };
  }
}
