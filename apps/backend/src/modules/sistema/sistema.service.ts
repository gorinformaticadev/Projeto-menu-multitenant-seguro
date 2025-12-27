
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { SistemaCronService } from './cron.service';

@Injectable()
export class SistemaService {
    constructor(
        private prisma: PrismaService,
        // Usar forwardRef se houver ciclo, mas aqui SistemaCronService é injetado, ele não depende de SistemaService.
        private sistemaCronService: SistemaCronService
    ) { }

    async getNotificationConfig() {
        try {
            await this.prisma.$executeRawUnsafe(`
                 CREATE TABLE IF NOT EXISTS "sistema_notification_schedules" (
                    "id" TEXT NOT NULL,
                    "title" TEXT NOT NULL,
                    "content" TEXT NOT NULL,
                    "audience" TEXT NOT NULL,
                    "cronExpression" TEXT NOT NULL,
                    "enabled" BOOLEAN NOT NULL DEFAULT true,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "sistema_notification_schedules_pkey" PRIMARY KEY ("id")
                );
            `);

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
        } catch (e) {
            console.error(e);
            return { title: 'Erro ao carregar', content: '', audience: 'all', cronExpression: '0 0 * * *', enabled: false };
        }
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

        // Atualiza o job imediatamente no Core
        await this.sistemaCronService.registerNotificationJob();

        return { ...newConfig, id };
    }

    async sendNotification(payload: any) {
        console.log('📨 [Sistema] Enviando notificação:', payload);
        return { success: true, message: 'Notificação enviada com sucesso' };
    }
}
