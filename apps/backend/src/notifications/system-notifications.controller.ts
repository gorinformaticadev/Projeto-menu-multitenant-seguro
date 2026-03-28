import { Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { NotificationService } from './notification.service';
import {
  ListSystemNotificationsQueryDto,
  ReadAllSystemNotificationsDto,
  SystemNotificationSeverityFilter,
} from './dto/system-notifications.dto';

type NotificationsRequest = ExpressRequest & {
  user?: {
    id?: string;
    sub?: string;
    role?: string;
  };
};

@Controller('system/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Query() query: ListSystemNotificationsQueryDto) {
    const page = this.parsePositiveInt(query.page);
    const limit = this.parsePositiveInt(query.limit);
    const isRead = this.parseBooleanQuery(query.isRead);
    const unreadOnly = this.parseBooleanQuery(query.unreadOnly);
    const severity = this.parseSeverity(query.severity);

    return this.notificationService.list({
      page,
      limit,
      isRead,
      unreadOnly,
      severity,
      targetRole: 'SUPER_ADMIN',
    });
  }

  @Get('unread-count')
  async unreadCount() {
    const count = await this.notificationService.getUnreadCount({
      targetRole: 'SUPER_ADMIN',
    });

    return { count };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @Request() req: NotificationsRequest) {
    const notification = await this.notificationService.markSystemNotificationAsRead(id, {
      userId: req?.user?.id || req?.user?.sub,
      role: req?.user?.role,
      targetRole: 'SUPER_ADMIN',
    });

    return {
      success: !!notification,
      notification,
    };
  }

  @Post('read-all')
  async markAllRead(@Request() req: NotificationsRequest, @Query() query: ReadAllSystemNotificationsDto) {
    const count = await this.notificationService.markAllSystemNotificationsAsRead({
      userId: query?.targetUserId || req?.user?.id || req?.user?.sub,
      role: req?.user?.role,
      targetRole: query?.targetRole || 'SUPER_ADMIN',
      targetUserId: query?.targetUserId,
    });

    return {
      success: true,
      count,
    };
  }

  private parsePositiveInt(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }

  private parseBooleanQuery(value?: string): boolean | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no'].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  private parseSeverity(value?: string): SystemNotificationSeverityFilter | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') {
      return normalized;
    }

    return undefined;
  }
}
