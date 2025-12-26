
import { Controller, Get, Post, Body, UseGuards, Put } from '@nestjs/common';
import { Roles } from '../../../../apps/backend/src/core/roles.decorator';
import { RolesGuard } from '../../../../apps/backend/src/core/roles.guard';
import { JwtAuthGuard } from '../../../../apps/backend/src/core/jwt-auth.guard';
import { PrismaService } from '../../../../apps/backend/src/core/prisma/prisma.service';
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
        const config = await (this.prisma as any).sistemaNotificationSchedule.findFirst({
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
        const existing = await (this.prisma as any).sistemaNotificationSchedule.findFirst();

        let result;
        if (existing) {
            result = await (this.prisma as any).sistemaNotificationSchedule.update({
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
            result = await (this.prisma as any).sistemaNotificationSchedule.create({
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
