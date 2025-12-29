
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
        // Uso de QueryRaw pois a tabela é dinâmica do módulo e não está no schema.prisma
        const result = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM mod_sistema_notification_schedules 
            WHERE enabled = true 
            LIMIT 1
        `;

        const config = result[0];

        return config ? {
            id: config.id,
            title: config.title,
            content: config.content,
            audience: config.audience,
            cronExpression: config.cron_expression,
            enabled: config.enabled
        } : {
            title: '',
            content: '',
            audience: 'all',
            cronExpression: '0 0 * * *',
            enabled: true
        };
    }

    @Post('notifications')
    async saveNotificationConfig(@Body() body: any) {
        // Verifica se já existe (QueryRaw)
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM mod_sistema_notification_schedules LIMIT 1
        `;

        let result;
        if (existing && existing.length > 0) {
            // Update via ExecuteRaw
            const id = existing[0].id;
            result = await this.prisma.$executeRaw`
                UPDATE mod_sistema_notification_schedules
                SET title = ${body.title},
                    content = ${body.content},
                    audience = ${body.audience},
                    cron_expression = ${body.cronExpression},
                    enabled = ${body.enabled},
                    updated_at = NOW()
                WHERE id = ${id}::uuid
            `;
        } else {
            // Insert via ExecuteRaw
            result = await this.prisma.$executeRaw`
                INSERT INTO mod_sistema_notification_schedules 
                (title, content, audience, cron_expression, enabled)
                VALUES (
                    ${body.title}, 
                    ${body.content}, 
                    ${body.audience}, 
                    ${body.cronExpression}, 
                    ${body.enabled}
                )
            `;
        }

        // Refresh the cron job immediately
        await this.sistemaCron.registerNotificationJob();

        return result;
    }
}
