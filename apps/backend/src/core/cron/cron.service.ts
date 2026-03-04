import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';

export interface CronJobDefinition {
  key: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  settingsUrl?: string;
  origin?: 'core' | 'modulo';
  editable?: boolean;
}

type JobWrapper = {
  definition: CronJobDefinition;
  callback: () => Promise<void> | void;
  job?: CronJob;
};

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private readonly jobs = new Map<string, JobWrapper>();
  private maintenancePaused = false;
  private pausedCronJobs = new Set<string>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Inicializando Cron Service...');
    await this.syncWithDatabase();
  }

  private async syncWithDatabase() {
    try {
      const dbJobs = await this.prisma.cronSchedule.findMany();

      for (const dbJob of dbJobs) {
        const modulo = dbJob.modulo || 'core';
        const key = `${modulo}.${dbJob.identificador}`;
        const wrapper = this.jobs.get(key);

        if (!wrapper) {
          this.jobs.set(key, {
            definition: {
              key,
              name: dbJob.identificador,
              description: dbJob.descricao || '',
              schedule: dbJob.expressao,
              enabled: dbJob.ativo,
              origin: dbJob.origem as 'core' | 'modulo',
              editable: dbJob.editavel,
            },
            callback: async () => {
              this.logger.warn(`Job ${key} acionado sem callback registrado.`);
            },
          });
          continue;
        }

        wrapper.definition.schedule = dbJob.expressao;
        wrapper.definition.enabled = dbJob.ativo;
        wrapper.definition.description = dbJob.descricao || wrapper.definition.description;
        wrapper.definition.origin = dbJob.origem as 'core' | 'modulo';
        wrapper.definition.editable = dbJob.editavel;

        await this.recreateScheduledJob(key, wrapper, dbJob.expressao, dbJob.ativo, modulo, dbJob.identificador);
      }
    } catch (error) {
      this.logger.error('Erro ao sincronizar Crons com o banco:', error);
    }
  }

  async register(
    key: string,
    schedule: string,
    callback: () => Promise<void> | void,
    meta: {
      name: string;
      description: string;
      settingsUrl?: string;
      origin?: 'core' | 'modulo';
      editable?: boolean;
    },
  ) {
    if (!schedule) {
      this.logger.error(`Tentativa de registrar Cron Job ${key} sem expressão de agendamento.`);
      return;
    }

    if (!this.isValidCronExpression(schedule)) {
      this.logger.error(`Expressão cron inválida para ${key}: ${schedule}`);
      return;
    }

    const { modulo, identificador } = this.parseKey(key);
    const origin = meta.origin || 'modulo';
    const editable = meta.editable ?? true;

    const existing = await this.prisma.cronSchedule.findUnique({
      where: { modulo_identificador: { modulo, identificador } },
    });

    if (existing) {
      await this.prisma.cronSchedule.update({
        where: { modulo_identificador: { modulo, identificador } },
        data: {
          descricao: meta.description,
          origem: origin,
          editavel: editable,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.cronSchedule.create({
        data: {
          origem: origin,
          modulo,
          identificador,
          descricao: meta.description,
          expressao: schedule,
          ativo: true,
          editavel: editable,
        },
      });
    }

    const persisted = await this.prisma.cronSchedule.findUnique({
      where: { modulo_identificador: { modulo, identificador } },
    });

    if (!persisted) {
      this.logger.error(`Falha ao carregar cron persistido: ${key}`);
      return;
    }

    const effectiveSchedule = persisted.expressao;
    const isEnabled = persisted.ativo;

    if (!this.isValidCronExpression(effectiveSchedule)) {
      this.logger.error(`Expressão cron inválida persistida para ${key}: ${effectiveSchedule}`);
      return;
    }

    this.deleteCronJobOnly(key);

    const definition: CronJobDefinition = {
      key,
      name: meta.name,
      description: meta.description,
      schedule: effectiveSchedule,
      enabled: isEnabled,
      settingsUrl: meta.settingsUrl,
      origin: persisted.origem as 'core' | 'modulo',
      editable: persisted.editavel,
    };

    const wrapper: JobWrapper = { definition, callback };
    await this.recreateScheduledJob(key, wrapper, effectiveSchedule, isEnabled, modulo, identificador);
    this.jobs.set(key, wrapper);

    this.logger.log(`Cron Job registrado: ${key} (${effectiveSchedule}) - Ativo: ${isEnabled}`);
  }

  private buildCronJob(
    key: string,
    schedule: string,
    callback: () => Promise<void> | void,
    definition: CronJobDefinition,
    modulo: string,
    identificador: string,
  ): CronJob {
    const job = new CronJob(schedule, async () => {
      if (this.maintenancePaused) {
        this.logger.log(`Job ${key} pausado por maintenance mode de restore`);
        return;
      }

      const current = await this.prisma.cronSchedule.findUnique({
        where: { modulo_identificador: { modulo, identificador } },
      });

      if (!current || !current.ativo) {
        this.logger.log(`Job ${key} ignorado (desativado no banco).`);
        return;
      }

      try {
        this.logger.log(`Executando Cron Job: ${key}`);
        definition.lastRun = new Date();
        await callback();
      } catch (error) {
        this.logger.error(`Erro ao executar Cron Job ${key}:`, error);
      } finally {
        definition.nextRun = this.safeNextRun(job);
      }
    });

    return job;
  }

  private async recreateScheduledJob(
    key: string,
    wrapper: JobWrapper,
    schedule: string,
    enabled: boolean,
    modulo: string,
    identificador: string,
  ) {
    if (wrapper.job) {
      wrapper.job.stop();
      wrapper.job = undefined;
    }
    this.deleteCronJobOnly(key);

    wrapper.definition.schedule = schedule;
    wrapper.definition.enabled = enabled;

    if (!enabled) {
      wrapper.definition.nextRun = undefined;
      return;
    }

    const job = this.buildCronJob(
      key,
      schedule,
      wrapper.callback,
      wrapper.definition,
      modulo,
      identificador,
    );

    this.schedulerRegistry.addCronJob(key, job);
    job.start();
    wrapper.job = job;
    wrapper.definition.nextRun = this.safeNextRun(job);
  }

  private deleteCronJobOnly(key: string) {
    try {
      if (this.schedulerRegistry.doesExist('cron', key)) {
        this.schedulerRegistry.deleteCronJob(key);
      }
    } catch {
      // noop
    }
  }

  private parseKey(key: string): { modulo: string; identificador: string } {
    const parts = key.split('.');
    if (parts.length <= 1) {
      return { modulo: 'core', identificador: key };
    }

    const modulo = parts[0] || 'core';
    const identificador = parts.slice(1).join('.') || key;
    return { modulo, identificador };
  }

  private isValidCronExpression(schedule: string): boolean {
    try {
      const probe = new CronJob(schedule, () => undefined);
      probe.stop();
      return true;
    } catch {
      return false;
    }
  }

  private safeNextRun(job: CronJob): Date | undefined {
    try {
      return job.nextDate().toJSDate();
    } catch {
      return undefined;
    }
  }

  delete(key: string) {
    this.deleteCronJobOnly(key);
    this.jobs.delete(key);
  }

  listJobs(): CronJobDefinition[] {
    return Array.from(this.jobs.values()).map((wrapper) => {
      if (wrapper.job) {
        wrapper.definition.nextRun = this.safeNextRun(wrapper.job);
      }
      return wrapper.definition;
    });
  }

  async toggle(key: string, enable: boolean) {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron Job ${key} não encontrado`);
    }

    const { modulo, identificador } = this.parseKey(key);

    await this.prisma.cronSchedule.update({
      where: { modulo_identificador: { modulo, identificador } },
      data: { ativo: enable, updatedAt: new Date() },
    });

    await this.recreateScheduledJob(
      key,
      wrapper,
      wrapper.definition.schedule,
      enable,
      modulo,
      identificador,
    );
  }

  async updateSchedule(key: string, schedule: string) {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron Job ${key} não encontrado`);
    }

    if (!this.isValidCronExpression(schedule)) {
      throw new Error(`Expressão cron inválida: ${schedule}`);
    }

    const { modulo, identificador } = this.parseKey(key);

    await this.prisma.cronSchedule.update({
      where: { modulo_identificador: { modulo, identificador } },
      data: { expressao: schedule, updatedAt: new Date() },
    });

    await this.recreateScheduledJob(
      key,
      wrapper,
      schedule,
      wrapper.definition.enabled,
      modulo,
      identificador,
    );
  }

  async trigger(key: string) {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron Job ${key} não encontrado`);
    }
    await wrapper.callback();
  }

  async stopJobsForModule(moduleName: string, tenantId?: string) {
    this.logger.log(`Parando crons para módulo: ${moduleName} (Tenant: ${tenantId || 'Todos'})`);

    for (const key of this.jobs.keys()) {
      if (!key.startsWith(`${moduleName}.`)) {
        continue;
      }

      let shouldStop = true;
      if (tenantId && !key.includes(tenantId)) {
        shouldStop = false;
        this.logger.debug(`Job ${key} ignorado pois não contém tenantId ${tenantId}`);
      }

      if (shouldStop) {
        await this.toggle(key, false);
      }
    }
  }

  pauseAllForMaintenance(): void {
    if (this.maintenancePaused) {
      return;
    }

    this.maintenancePaused = true;
    this.pausedCronJobs.clear();
    const cronJobs = this.schedulerRegistry.getCronJobs();

    for (const [name, job] of cronJobs) {
      try {
        const isActive = (job as any).running === true;
        if (isActive) {
          job.stop();
          this.pausedCronJobs.add(name);
        }
      } catch (error) {
        this.logger.warn(`Falha ao pausar cron ${name}: ${String(error)}`);
      }
    }

    this.logger.log(`Cron jobs pausados para maintenance: ${this.pausedCronJobs.size}`);
  }

  resumeAllAfterMaintenance(): void {
    const toResume = Array.from(this.pausedCronJobs.values());
    const cronJobs = this.schedulerRegistry.getCronJobs();

    for (const name of toResume) {
      const job = cronJobs.get(name);
      if (!job) {
        continue;
      }

      try {
        job.start();
      } catch (error) {
        this.logger.warn(`Falha ao retomar cron ${name}: ${String(error)}`);
      }
    }

    this.pausedCronJobs.clear();
    this.maintenancePaused = false;
    this.logger.log('Cron jobs retomados apos maintenance');
  }

  isMaintenancePaused(): boolean {
    return this.maintenancePaused;
  }
}
