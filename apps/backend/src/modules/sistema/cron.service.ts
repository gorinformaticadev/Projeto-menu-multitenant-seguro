
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronService } from '../../core/cron/cron.service';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * Serviço de Cron para o módulo Sistema
 * Gerencia a tarefa de Notificações Automáticas
 */
@Injectable()
export class SistemaCronService implements OnModuleInit {
    private readonly logger = new Logger(SistemaCronService.name);

    constructor(
        private cronService: CronService,
        private prisma: PrismaService
    ) { }

    async onModuleInit() {
        this.logger.log('Inicializando Sistema Cron Service');
        await this.ensureDatabaseTable();
        await this.registerNotificationJob();
    }

    private async ensureDatabaseTable() {
        try {
            // Fallback creation matching the migration
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS mod_sistema_notification_schedules (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    content TEXT,
                    audience VARCHAR(50) DEFAULT 'all',
                    cron_expression VARCHAR(100) NOT NULL,
                    enabled BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (error) {
            // Ignore error if table exists or extension missing, strictly a fallback
            this.logger.warn('Aviso ao verificar tabela mod_sistema_notification_schedules: ' + error.message);
        }
    }

    // Registra todos os agendamentos ativos
    async registerNotificationJob() {
        try {
            const schedules = await this.prisma.$queryRawUnsafe<any[]>(`
                SELECT * FROM mod_sistema_notification_schedules
            `);

            const activeKeys = new Set<string>();

            for (const config of schedules) {
                const key = `sistema.auto_notification.${config.id}`;

                if (config.enabled) {
                    // Register or Update
                    await this.cronService.register(
                        key,
                        config.cron_expression,
                        async () => {
                            await this.executeNotificationJob(config);
                        },
                        {
                            name: 'Notif: ' + config.title,
                            description: 'Notificação Automática do Sistema',
                            settingsUrl: '/modules/sistema/ajustes'
                        }
                    );
                    activeKeys.add(key);
                } else {
                    // Ensure disabled jobs are removed from scheduler
                    this.cronService.delete(key);
                }
            }

            // Cleanup legacy singleton job if exists
            this.cronService.delete('sistema.auto_notification');

            // Cleanup jobs that were deleted from DB (orphans in CronService)
            const allJobs = this.cronService.listJobs();
            for (const job of allJobs) {
                // If it belongs to this module logic but is not active
                if (job.key.startsWith('sistema.auto_notification.') && !activeKeys.has(job.key)) {
                    this.cronService.delete(job.key);
                }
            }

        } catch (e) {
            this.logger.error('Erro ao registrar jobs:', e);
        }
    }

    private async executeNotificationJob(config: any) {
        this.logger.log(`Executando Notificação Automática: ${config.title}`);

        try {
            await this.prisma.notification.create({
                data: {
                    title: config.title,
                    message: config.content,
                    severity: 'info',
                    audience: config.audience || 'all',
                    source: 'module',
                    module: 'sistema',
                    read: false
                }
            });
            this.logger.log(`Notificação criada com sucesso.`);
        } catch (e) {
            this.logger.error('Erro ao criar notificação:', e);
        }
    }
}
