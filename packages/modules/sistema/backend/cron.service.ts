
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronService } from '../../../../apps/backend/src/core/cron/cron.service';
import { PrismaService } from '../../../../apps/backend/src/core/prisma/prisma.service';

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
        await this.registerNotificationJob();
    }

    // Registra ou atualiza o job baseando-se no banco de dados
    async registerNotificationJob() {
        // Busca a configuração no banco (assumindo apenas 1 configuração por enquanto)
        const config = await (this.prisma as any).sistemaNotificationSchedule.findFirst({
            where: { enabled: true }
        });

        if (!config) {
            this.logger.log('Nenhuma configuração de notificação automática ativa encontrada.');
            // Se existir um job antigo registrado, remove
            if (this.cronService['jobs'].has('sistema.auto_notification')) {
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

        // Cria a notificação na tabela 'notifications'
        await this.prisma.notification.create({
            data: {
                title: config.title,
                message: config.content,
                severity: 'info',
                audience: config.audience, // 'admin', 'super_admin', 'user' (all)
                source: 'module',
                module: 'sistema',
                read: false
            }
        });

        this.logger.log(`Notificação criada com sucesso para audiência: ${config.audience}`);
    }
}
