
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

export interface CronJobDefinition {
    key: string;
    name: string;
    description: string;
    schedule: string; // Cron expression
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
}

@Injectable()
export class CronService implements OnModuleInit {
    private readonly logger = new Logger(CronService.name);
    private readonly jobs = new Map<string, {
        definition: CronJobDefinition;
        callback: () => Promise<void> | void;
        job?: CronJob;
    }>();

    constructor(private schedulerRegistry: SchedulerRegistry) { }

    onModuleInit() {
        this.logger.log('Inicializando Cron Service...');
    }

    /**
     * Registra um novo Cron Job vindo de um módulo
     */
    register(
        key: string,
        schedule: string,
        callback: () => Promise<void> | void,
        meta: { name: string; description: string }
    ) {
        if (this.jobs.has(key)) {
            this.logger.warn(`Cron job ${key} já registrado. Sobrescrevendo...`);
            this.delete(key);
        }

        const definition: CronJobDefinition = {
            key,
            name: meta.name,
            description: meta.description,
            schedule,
            enabled: true, // Default to enabled
        };

        // Cria o job do 'cron' package
        const job = new CronJob(schedule, async () => {
            try {
                this.logger.log(`Executando Cron Job: ${key}`);
                definition.lastRun = new Date();
                await callback();
                definition.nextRun = job.nextDate().toJSDate();
            } catch (error) {
                this.logger.error(`Erro ao executar Cron Job ${key}:`, error);
            }
        });

        this.schedulerRegistry.addCronJob(key, job);
        job.start();

        definition.nextRun = job.nextDate().toJSDate();

        this.jobs.set(key, { definition, callback, job });
        this.logger.log(`Cron Job registrado: ${key} (${schedule})`);
    }

    /**
     * Remove um job
     */
    delete(key: string) {
        if (this.schedulerRegistry.doesExist('cron', key)) {
            this.schedulerRegistry.deleteCronJob(key);
        }
        this.jobs.delete(key);
    }

    /**
     * Lista todos os jobs
     */
    listJobs(): CronJobDefinition[] {
        return Array.from(this.jobs.values()).map(j => {
            // Atualiza nextRun em tempo real
            if (j.job) {
                j.definition.nextRun = j.job.nextDate().toJSDate();
            }
            return j.definition;
        });
    }

    /**
     * Executa um job manualmente
     */
    async trigger(key: string) {
        const jobWrapper = this.jobs.get(key);
        if (!jobWrapper) {
            throw new Error(`Cron Job ${key} não encontrado`);
        }

        this.logger.log(`Disparando manualmente Cron Job: ${key}`);
        return jobWrapper.callback();
    }

    /**
     * Pausa/Retoma um job
     */
    toggle(key: string, enable: boolean) {
        const jobWrapper = this.jobs.get(key);
        if (!jobWrapper || !jobWrapper.job) {
            throw new Error(`Cron Job ${key} não encontrado`);
        }

        if (enable) {
            jobWrapper.job.start();
            jobWrapper.definition.enabled = true;
        } else {
            jobWrapper.job.stop();
            jobWrapper.definition.enabled = false;
        }
    }
}
