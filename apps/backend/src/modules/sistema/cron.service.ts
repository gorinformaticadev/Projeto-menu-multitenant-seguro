
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
            // Cria a tabela manualmente se não existir, já que não usamos o schema global
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
            this.logger.log('Tabela sistema_notification_schedules verificada/criada.');
        } catch (error) {
            this.logger.error('Erro ao criar tabela do módulo sistema:', error);
        }
    }

    // Registra ou atualiza o job baseando-se no banco de dados
    async registerNotificationJob() {
        // Busca a configuração usando Raw SQL
        const results = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT * FROM "sistema_notification_schedules" WHERE enabled = true LIMIT 1
        `);

        const config = results[0];

        if (!config) {
            this.logger.log('Nenhuma configuração de notificação automática ativa encontrada.');
            // Se existir um job antigo registrado, remove
            if ((this.cronService as any)['jobs'].has('sistema.auto_notification')) {
                this.cronService.delete('sistema.auto_notification');
            }
            return;
        }

        this.logger.log(`Registrando Job de Notificação: ${config.title} (${config.cronExpression})`);

        this.cronService.register(
            'sistema.auto_notification',
            config.cronExpression,
            async () => {
                await this.executeNotificationJob(config);
            },
            {
                name: 'Notificação Automática: ' + config.title,
                description: 'Envia notificações automáticas configuradas no módulo Sistema.',
                settingsUrl: '/modules/sistema/ajustes' // Link para a página de config do módulo
            }
        );
    }

    // A lógica de execução do job
    private async executeNotificationJob(config: any) {
        this.logger.log(`Executando Notificação Automática: ${config.title}`);

        try {
            await this.prisma.notification.create({
                data: {
                    title: config.title,
                    message: config.content,
                    severity: 'info',
                    audience: config.audience,
                    source: 'module',
                    module: 'sistema',
                    read: false
                }
            });
            this.logger.log(`Notificação criada com sucesso para audiência: ${config.audience}`);
        } catch (e) {
            this.logger.error('Erro ao criar notificação:', e);
        }
    }
}
