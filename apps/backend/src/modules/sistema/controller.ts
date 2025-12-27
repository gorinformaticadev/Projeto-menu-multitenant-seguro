
import { Controller, Get, Post, Body, UseGuards, Put } from '@nestjs/common';
import { Roles } from '@core/roles.decorator';
import { RolesGuard } from '@core/roles.guard';
import { JwtAuthGuard } from '@core/jwt-auth.guard';
import { PrismaService } from '@core/prisma/prisma.service';
import { SistemaCronService } from './cron.service';

@Controller('modules/sistema/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SistemaConfigController {
    constructor(
        private prisma: PrismaService,
        private sistemaCron: SistemaCronService
    ) { }

    @Get('notifications')
    async getNotificationConfig() {
        const config = await (this.prisma as any).modSistemaNotificationSchedule.findFirst({
            where: { enabled: true }
        });
        return config || {
            title: '',
            content: '',
            audience: 'all',
            cronExpression: '0 0 * * *',
            enabled: true
        };
    }

    @Post('notifications')
    async saveNotificationConfig(@Body() body: any) {
        // Upsert logic (assuming single config for now)
        const existing = await (this.prisma as any).modSistemaNotificationSchedule.findFirst();

        let result;
        if (existing) {
            result = await (this.prisma as any).modSistemaNotificationSchedule.update({
                where: { id: existing.id },
                data: {
                    title: body.title,
                    content: body.content,
                    audience: body.audience,
                    cronExpression: body.cronExpression,
                    enabled: body.enabled
                }
            });
        } else {
            result = await (this.prisma as any).modSistemaNotificationSchedule.create({
                data: {
                    title: body.title,
                    content: body.content,
                    audience: body.audience,
                    cronExpression: body.cronExpression,
                    enabled: body.enabled
                }
            });
        }

        // Refresh the cron job immediately
        await this.sistemaCron.registerNotificationJob();

        return result;
    }
}
