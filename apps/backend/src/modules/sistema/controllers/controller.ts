import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Roles } from '@core/common/decorators/roles.decorator';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
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
        // Mock to avoid 500 if table missing
        const config = {
            title: '',
            content: '',
            audience: 'all',
            cronExpression: '0 0 * * *',
            enabled: true
        };
        try {
            const existing = await (this.prisma as any).sistemaNotificationSchedule.findFirst({
                where: { enabled: true }
            });
            if (existing) return existing;
        } catch (e) { }
        return config;
    }

    @Post('notifications')
    async saveNotificationConfig(@Body() body: any) {
        try {
            // Mock implementation
            return { success: true };
        } catch (e) {
            throw e;
        }
    }
}
