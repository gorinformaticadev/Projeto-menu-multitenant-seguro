
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';

export interface CronJobDefinition {
    key: string;
    name: string;
    description: string;
    schedule: string; // Cron expression
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    settingsUrl?: string;
    origin?: 'core' | 'modulo';
    editable?: boolean;
}

@Injectable()
export class CronService implements OnModuleInit {
    private readonly logger = new Logger(CronService.name);
    private readonly jobs = new Map<string, {
        definition: CronJobDefinition;
        callback: () => Promise<void> | void;
        job?: CronJob;
    }>();

    constructor(
        private schedulerRegistry: SchedulerRegistry,
        private prisma: PrismaService
    ) {
      // Empty implementation
    }

    async onModuleInit() {
        this.logger.log('Inicializando Cron Service...');
        await this.syncWithDatabase();
    }

    private async syncWithDatabase() {
        try {
            // Verifica/Carrega jobs do banco
            const dbJobs = await this.prisma.cronSchedule.findMany();

            for (const dbJob of dbJobs) {
                const key = `${dbJob.modulo}.${dbJob.identificador}`;

                // Se o job já existe em memória (registrado pelo módulo), atualiza o estado
                if (this.jobs.has(key)) {
                    const wrapper = this.jobs.get(key);
                    if (wrapper) {
                        // Atualiza estado baseado no banco
                        if (dbJob.ativo && !wrapper.definition.enabled) {
                            this.toggle(key, true);
                        } else if (!dbJob.ativo && wrapper.definition.enabled) {
                            this.toggle(key, false);
                        }
                    }
                } else {
                    // Job existe no banco mas não foi registrado em memória (módulo inativo ou removido?)
                    // Exibe como "Desconhecido" ou apenas listagem
                    // Para fins de UI, podemos manter na lista mas sem callback executável
                    this.jobs.set(key, {
                        definition: {
                            key,
                            name: dbJob.identificador, // Fallback name
                            description: dbJob.descricao || '',
                            schedule: dbJob.expressao,
                            enabled: dbJob.ativo,
                            origin: dbJob.origem as 'core' | 'modulo',
                            editable: dbJob.editavel
                        },
                        callback: async () => { this.logger.warn(`Job ${key} acionado mas sem callback registrado.`); }
                    });
                }
            }
        } catch (error) {
            this.logger.error('Erro ao sincronizar Crons com o banco:', error);
        }
    }

    /**
     * Registra um novo Cron Job vindo de um módulo e persiste na tabela base
     */
    async register(
        key: string,
        schedule: string,
        callback: () => Promise<void> | void,
        meta: { name: string; description: string; settingsUrl?: string }
    ) {
        if (!schedule) {
            this.logger.error(`Tentativa de registrar Cron Job ${key} sem expressão de agendamento definida.`);
            return;
        }

        // Extrai modulo e identificador da key (ex: "sistema.auto_notification")
        const parts = key.split('.');
        let modulo = 'core';
        let identificador = key;

        if (parts.length > 1) {
            modulo = parts[0];
            identificador = parts.slice(1).join('.') || key;
        }

        // Persiste no Core
        try {
            await this.prisma.cronSchedule.upsert({
                where: {
                    modulo_identificador: {
                        modulo,
                        identificador
                    }
                },
                update: {
                    expressao: schedule,
                    descricao: meta.description,
                    updatedAt: new Date()
                },
                create: {
                    origem: 'modulo',
                    modulo,
                    identificador,
                    descricao: meta.description,
                    expressao: schedule,
                    ativo: true,
                    editavel: true
                }
            });
        } catch (e) {
            this.logger.error(`Erro ao persistir cron ${key} no banco:`, e);
        }

        // Recupera status atual do banco para respeitar desativação pelo usuário
        const dbJob = await this.prisma.cronSchedule.findUnique({
            where: { modulo_identificador: { modulo, identificador } }
        });

        const isEnabled = dbJob ? dbJob.ativo : true;

        if (this.jobs.has(key)) {
            this.deleteCronJobOnly(key); // Remove apenas o agendamento em memória para recriar
        }

        const definition: CronJobDefinition = {
            key,
            name: meta.name,
            description: meta.description,
            schedule,
            enabled: isEnabled,
            settingsUrl: meta.settingsUrl,
            origin: 'modulo',
            editable: true
        };

        const job = new CronJob(schedule, async () => {
            // Verifica status no banco antes de executar (double check)
            const current = await this.prisma.cronSchedule.findUnique({
                where: { modulo_identificador: { modulo, identificador } }
            });

            if (!current || !current.ativo) {
                this.logger.log(`Job ${key} ignorado (desativado no banco).`);
                return;
            }

            try {
                this.logger.log(`Executando Cron Job: ${key}`);
                definition.lastRun = new Date();
                await callback();
                definition.nextRun = job.nextDate().toJSDate();
            } catch (error) {
                this.logger.error(`Erro ao executar Cron Job ${key}:`, error);
            }
        });

        if (isEnabled) {
            this.schedulerRegistry.addCronJob(key, job);
            job.start();
        }

        definition.nextRun = isEnabled ? job.nextDate().toJSDate() : undefined;

        this.jobs.set(key, { definition, callback, job: isEnabled ? job : undefined });
        this.logger.log(`Cron Job registrado: ${key} (${schedule}) - Ativo: ${isEnabled}`);
    }

    private deleteCronJobOnly(key: string) {
        try {
            if (this.schedulerRegistry.doesExist('cron', key)) {
                this.schedulerRegistry.deleteCronJob(key);
            }
        } catch (error) {
      // Error handled silently
    }
    }

    delete(key: string) {
        this.deleteCronJobOnly(key);
        this.jobs.delete(key);
        // Opcional: Marcar como inativo no banco ou remover? O requisito diz "Core apenas lê". 
        // O módulo pode pedir para remover, mas vamos manter o histórico se possível, ou setar ativo=false.
    }

    listJobs(): CronJobDefinition[] {
        return Array.from(this.jobs.values()).map(j => {
            if (j.job) {
                try {
                    j.definition.nextRun = j.job.nextDate().toJSDate();
                } catch (error) {
      // Error handled silently
    }
            }
            return j.definition;
        });
    }

    async toggle(key: string, enable: boolean) {
        const jobWrapper = this.jobs.get(key);
        if (!jobWrapper) {
            throw new Error(`Cron Job ${key} não encontrado`);
        }

        const [modulo, ...rest] = key.split('.');
        const identificador = rest.join('.') || key;

        // Atualiza banco
        await this.prisma.cronSchedule.update({
            where: { modulo_identificador: { modulo, identificador } },
            data: { ativo: enable }
        });

        // Atualiza Memória
        if (enable) {
            if (!jobWrapper.job) {
                // Se não tem job instanciado, precisa recriar via register ou guardar a factory?
                // Como não guardamos a factory, vamos assumir que o job só foi pausado (stop).
                // Mas se não estava no scheduler, precisamos recriar.
                // Simplificação: Se temos o callback, recriamos o CronJob.
                const job = new CronJob(jobWrapper.definition.schedule, async () => {
                    jobWrapper.definition.lastRun = new Date();
                    await jobWrapper.callback();
                });
                this.schedulerRegistry.addCronJob(key, job);
                jobWrapper.job = job;
            }
            jobWrapper.job.start();
            jobWrapper.definition.enabled = true;
        } else {
            if (jobWrapper.job) {
                jobWrapper.job.stop();
            }
            jobWrapper.definition.enabled = false;
        }
    }

    // Trigger manual permanece igual
    async trigger(key: string) {
        const jobWrapper = this.jobs.get(key);
        if (jobWrapper) await jobWrapper.callback();
    }

    /**
     * Pára os crons relacionados a um módulo.
     * Se tenantId for fornecido, tenta filtrar jobs que contenham o ID do tenant na chave.
     * Se tenantId não for fornecido, pára todos os crons do módulo.
     */
    async stopJobsForModule(moduleName: string, tenantId?: string) {
        this.logger.log(`Parando crons para módulo: ${moduleName} (Tenant: ${tenantId || 'Todos'})`);

        for (const key of this.jobs.keys()) {
            // Verifica se o job pertence ao módulo
            if (key.startsWith(`${moduleName}.`)) {
                let shouldStop = true;

                // Se tenantId foi passado, só para se o job parecer ser específico deste tenant
                // (por convenção de nomenclatura ou se assumirmos que jobs do módulo devem parar)
                if (tenantId) {
                    if (!key.includes(tenantId)) {
                        shouldStop = false;
                        this.logger.debug(`Job ${key} ignorado pois não contém tenantId ${tenantId}`);
                    }
                }

                if (shouldStop) {
                    this.logger.log(`Parando job ${key} devido a desativação do módulo.`);
                    await this.toggle(key, false);
                }
            }
        }
    }
}
