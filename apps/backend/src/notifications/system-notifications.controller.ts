import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable, map } from 'rxjs';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { NotificationService } from './notification.service';
import { NotificationsSseJwtGuard } from './guards/notifications-sse-jwt.guard';

@Controller('system/notifications')
export class SystemNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('unreadOnly') unreadOnlyRaw?: string,
  ) {
    const page = Number.parseInt(String(pageRaw || ''), 10);
    const limit = Number.parseInt(String(limitRaw || ''), 10);
    const unreadOnly = ['1', 'true', 'yes'].includes(String(unreadOnlyRaw || '').toLowerCase());

    return this.notificationService.listSystemNotifications({
      page: Number.isFinite(page) ? page : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      unreadOnly,
    });
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async markRead(@Param('id') id: string) {
    const notification = await this.notificationService.markSystemNotificationAsRead(id);
    return {
      success: !!notification,
      notification,
    };
  }

  @Sse('stream')
  @UseGuards(NotificationsSseJwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  stream(@Request() req: any): Observable<MessageEvent> {
    const authHeader = String(req.headers?.authorization || '');
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const tokenFromQuery = String(req.query?.token || '').trim();
    const token = tokenFromHeader || tokenFromQuery;

    if (!token) {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next({ type: 'system_alert', data: { error: 'token_required' } });
        subscriber.complete();
      });
    }

    return this.notificationService.getSystemAlertStream().pipe(
      map((notification) => ({
        type: 'system_alert',
        data: notification,
      })),
    );
  }
}
