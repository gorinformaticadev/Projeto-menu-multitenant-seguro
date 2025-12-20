import { Controller, Get, Patch, Param, UseGuards, Req, Query, Post, Body } from '@nestjs/common';
import { NotificationStore } from './notification.store';
import { NotificationService } from '../notification.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(
        private store: NotificationStore,
        private service: NotificationService
    ) { }

    @Get('center')
    async center(@Req() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
        const notifications = await this.store.list(req.user.tenantId, req.user.id, Number(page), Number(limit));
        const total = await this.store.count(req.user.tenantId, req.user.id);
        const unreadCount = await this.store.countUnread(req.user.tenantId, req.user.id);

        return {
            notifications,
            total,
            unreadCount,
            hasMore: total > Number(page) * Number(limit)
        };
    }

    @Get('dropdown')
    async dropdown(@Req() req: any) {
        const notifications = await this.store.list(req.user.tenantId, req.user.id, 1, 15);
        const unreadCount = await this.store.countUnread(req.user.tenantId, req.user.id);
        const total = await this.store.count(req.user.tenantId, req.user.id);

        return {
            notifications,
            total,
            unreadCount,
            hasMore: total > 15
        };
    }

    @Get('unread-count')
    async unreadCount(@Req() req: any) {
        const count = await this.store.countUnread(req.user.tenantId, req.user.id);
        return { count };
    }

    @Patch(':id/read')
    async markAsRead(@Req() req: any, @Param('id') id: string) {
        return this.store.markAsRead(id, req.user.id);
    }

    @Post('send')
    async send(@Req() req: any, @Body() body: any) {
        // Map frontend payload to core types
        // Frontend: { titulo, mensagem, tipo, destino, critica }
        // Core: { title, message, severity, audience, ... }

        const severity = body.critica ? 'critical' : (body.tipo === 'info' ? 'info' : 'warning');
        // 'success' and 'error' from frontend map to 'info'/'warning'/'critical' roughly, 
        // but NotificationService handles logic. Let's pass closest.

        await this.service.createNotification({
            title: body.titulo,
            message: body.mensagem,
            severity: severity,
            audience: body.destino === 'todos_tenants' ? 'super_admin' : 'user', // Simplified
            tenantId: body.destino === 'todos_tenants' ? undefined : req.user.tenantId,
            source: 'module',
            module: 'sistema', // or dynamic
            data: {
                originalType: body.tipo
            }
        });

        return { success: true };
    }
}
