
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SistemaService {
    constructor(private prisma: PrismaService) { }

    async getNotificationConfig() {
        const results = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT * FROM "sistema_notification_schedules" LIMIT 1
        `);
        return results[0] || {
            title: '',
            content: '',
            audience: 'all',
            cronExpression: '0 0 * * *',
            enabled: true
        };
    }

    async saveNotificationConfig(newConfig: any) {
        // Verifica se já existe
        const existing = await this.getNotificationConfig();
        const id = existing.id || uuidv4();
        const now = new Date().toISOString();

        if (existing.id) {
            await this.prisma.$executeRawUnsafe(`
                UPDATE "sistema_notification_schedules" 
                SET title = $1, content = $2, audience = $3, "cronExpression" = $4, enabled = $5, "updatedAt" = $6
                WHERE id = $7
            `, newConfig.title, newConfig.content, newConfig.audience, newConfig.cronExpression, newConfig.enabled, now, existing.id);
        } else {
            await this.prisma.$executeRawUnsafe(`
                INSERT INTO "sistema_notification_schedules" 
                ("id", "title", "content", "audience", "cronExpression", "enabled", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, id, newConfig.title, newConfig.content, newConfig.audience, newConfig.cronExpression, newConfig.enabled, now, now);
        }

        return { ...newConfig, id };
    }

    async sendNotification(payload: any) {
        console.log('📨 [Sistema] Enviando notificação:', payload);
        // Implementar lógica real se necessário, por enquanto log e retorno
        return { success: true, message: 'Notificação enviada com sucesso' };
    }
}
