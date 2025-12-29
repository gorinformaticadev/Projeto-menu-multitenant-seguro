
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
    async getNotificationConfigs() {
        // Retorna lista de agendamentos ordenados por criação
        const result = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM mod_sistema_notification_schedules 
            ORDER BY created_at DESC
        `;
        return result;
    }

    @Post('notifications')
    async createNotificationConfig(@Body() body: any) {
        // Sempre cria um novo registro
        const result = await this.prisma.$executeRaw`
            INSERT INTO mod_sistema_notification_schedules 
            (title, content, audience, cron_expression, enabled)
            VALUES (
                ${body.title}, 
                ${body.content}, 
                ${body.audience}, 
                ${body.cronExpression}, 
                ${body.enabled ?? true}
            )
        `;

        // Refresh the cron job immediately
        await this.sistemaCron.registerNotificationJob();

        return result;
    }
}
