import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import {
  CronJobHeartbeatRecord,
  CronJobHeartbeatService,
  CronJobHeartbeatStatus,
} from './cron-job-heartbeat.service';

export interface CronJobDefinition {
  key: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  idempotent?: boolean;
  lastRun?: Date;
  nextRun?: Date;
  settingsUrl?: string;
  origin?: 'core' | 'modulo';
  editable?: boolean;
  runtimeRegistered?: boolean;
  runtimeActive?: boolean;
  sourceOfTruth?: 'database';
  lastStartedAt?: Date;
  lastHeartbeatAt?: Date;
  lastSucceededAt?: Date;
  lastFailedAt?: Date;
  lastDurationMs?: number;
  lastStatus?: CronJobHeartbeatStatus;
  lastError?: string;
  nextExpectedRunAt?: Date;
  consecutiveFailureCount?: number;
  issue?: 'runtime_not_registered' | null;
  watchdogEnabled?: boolean;
  watchdogStaleAfterMs?: number;
  watchdogStuckAfterMs?: number;
}

type RegisterCronMeta = {
  name: string;
  description: string;
  settingsUrl?: string;
  origin?: 'core' | 'modulo';
  idempotent?: boolean;
  editable?: boolean;
  watchdogEnabled?: boolean;
  watchdogStaleAfterMs?: number;
  watchdogStuckAfterMs?: number;
};

type JobWrapper = {
  definition: CronJobDefinition;
  callback: () => Promise<void> | void;
  job?: CronJob;
  runtimeRegistered: boolean;
};

import { RedisLockService } from '../../common/services/redis-lock.service';

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private readonly jobs = new Map<string, JobWrapper>();
  private maintenancePaused = false;
  private pausedCronJobs = new Set<string>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly heartbeatService: CronJobHeartbeatService,
    private readonly redisLock: RedisLockService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Inicializando Cron Service...');
    await this.heartbeatService.reconcileOrphans();
    await this.syncWithDatabase();
  }

  async register(
    key: string,
    schedule: string,
    callback: () => Promise<void> | void,
    meta: RegisterCronMeta,
  ): Promise<void> {
    if (!schedule) {
      this.logger.error(`Tentativa de registrar cron ${key} sem expressao de agendamento.`);
      return;
    }

    if (!this.isValidCronExpression(schedule)) {
      this.logger.error(`Expressao cron invalida para ${key}: ${schedule}`);
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
      this.logger.error(`Expressao cron invalida persistida para ${key}: ${effectiveSchedule}`);
      return;
    }

    this.deleteCronJobOnly(key);

    const definition = this.buildBaseDefinition(
      key,
      {
        name: meta.name,
        description: meta.description,
        schedule: effectiveSchedule,
        enabled: isEnabled,
        settingsUrl: meta.settingsUrl,
        origin: persisted.origem as 'core' | 'modulo',
        editable: persisted.editavel,
        watchdogEnabled: meta.watchdogEnabled,
        watchdogStaleAfterMs: meta.watchdogStaleAfterMs,
        watchdogStuckAfterMs: meta.watchdogStuckAfterMs,
      },
      true,
    );

    this.applyHeartbeat(definition, await this.heartbeatService.get(key));

    const wrapper: JobWrapper = {
      definition,
      callback,
      runtimeRegistered: true,
    };

    await this.recreateScheduledJob(key, wrapper, effectiveSchedule, isEnabled, modulo, identificador);
    this.jobs.set(key, wrapper);

    this.logger.log(`Cron job registrado: ${key} (${effectiveSchedule}) - ativo: ${isEnabled}`);
  }

  async listJobs(): Promise<CronJobDefinition[]> {
    return this.buildRuntimeSnapshot();
  }

  async getRuntimeJobs(): Promise<CronJobDefinition[]> {
    return this.buildRuntimeSnapshot();
  }

  async toggle(key: string, enable: boolean): Promise<void> {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron job ${key} nao encontrado`);
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

  async updateSchedule(key: string, schedule: string): Promise<void> {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron job ${key} nao encontrado`);
    }

    if (!this.isValidCronExpression(schedule)) {
      throw new Error(`Expressao cron invalida: ${schedule}`);
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

  async trigger(key: string): Promise<void> {
    const wrapper = this.jobs.get(key);
    if (!wrapper) {
      throw new Error(`Cron job ${key} nao encontrado`);
    }

    const { modulo, identificador } = this.parseKey(key);
    await this.executeRegisteredJob(
      key,
      modulo,
      identificador,
      wrapper.callback,
      wrapper.definition,
      wrapper.job,
      {
        reason: 'manual',
        respectEnabledCheck: false,
        rethrowOnFailure: true,
      },
    );
  }

  delete(key: string): void {
    this.deleteCronJobOnly(key);
    this.jobs.delete(key);
  }

  async stopJobsForModule(moduleName: string, tenantId?: string): Promise<void> {
    this.logger.log(`Parando crons para modulo: ${moduleName} (Tenant: ${tenantId || 'Todos'})`);

    for (const key of this.jobs.keys()) {
      if (!key.startsWith(`${moduleName}.`)) {
        continue;
      }

      let shouldStop = true;
      if (tenantId && !key.includes(tenantId)) {
        shouldStop = false;
        this.logger.debug(`Job ${key} ignorado pois nao contem tenantId ${tenantId}`);
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
        const isActive = (job as { running?: boolean }).running === true;
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

  private async syncWithDatabase(): Promise<void> {
    try {
      const dbJobs = await this.prisma.cronSchedule.findMany();
      const heartbeatMap = await this.heartbeatService.list(
        dbJobs.map((job) => `${job.modulo || 'core'}.${job.identificador}`),
      );

      for (const dbJob of dbJobs) {
        const modulo = dbJob.modulo || 'core';
        const key = `${modulo}.${dbJob.identificador}`;
        const heartbeat = heartbeatMap.get(key);
        const wrapper = this.jobs.get(key);

        if (!wrapper) {
          const definition = this.buildBaseDefinition(
            key,
            {
              name: dbJob.identificador,
              description: dbJob.descricao || '',
              schedule: dbJob.expressao,
              enabled: dbJob.ativo,
              origin: dbJob.origem as 'core' | 'modulo',
              editable: dbJob.editavel,
            },
            false,
          );
          this.applyHeartbeat(definition, heartbeat);
          this.jobs.set(key, {
            definition,
            callback: async () => {
              this.logger.warn(`Job ${key} acionado sem callback registrado.`);
            },
            runtimeRegistered: false,
          });
          continue;
        }

        wrapper.definition.schedule = dbJob.expressao;
        wrapper.definition.enabled = dbJob.ativo;
        wrapper.definition.description = dbJob.descricao || wrapper.definition.description;
        wrapper.definition.origin = dbJob.origem as 'core' | 'modulo';
        wrapper.definition.editable = dbJob.editavel;
        wrapper.definition.runtimeRegistered = wrapper.runtimeRegistered;
        wrapper.definition.runtimeActive = Boolean(wrapper.job);
        wrapper.definition.sourceOfTruth = 'database';
        wrapper.definition.issue = wrapper.runtimeRegistered ? null : 'runtime_not_registered';
        this.applyHeartbeat(wrapper.definition, heartbeat);

        await this.recreateScheduledJob(key, wrapper, dbJob.expressao, dbJob.ativo, modulo, dbJob.identificador);
      }
    } catch (error) {
      this.logger.error('Erro ao sincronizar crons com o banco:', error);
    }
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
      await this.executeRegisteredJob(key, modulo, identificador, callback, definition, job, {
        reason: 'scheduled',
        respectEnabledCheck: true,
        rethrowOnFailure: false,
      });
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
  ): Promise<void> {
    if (wrapper.job) {
      wrapper.job.stop();
      wrapper.job = undefined;
    }

    this.deleteCronJobOnly(key);

    wrapper.definition.schedule = schedule;
    wrapper.definition.enabled = enabled;
    wrapper.definition.runtimeRegistered = wrapper.runtimeRegistered;
    wrapper.definition.runtimeActive = false;
    wrapper.definition.sourceOfTruth = 'database';
    wrapper.definition.issue = wrapper.runtimeRegistered ? null : 'runtime_not_registered';

    if (!enabled) {
      wrapper.definition.nextRun = undefined;
      wrapper.definition.nextExpectedRunAt = undefined;
      await this.heartbeatService.markScheduled(key, null);
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
    wrapper.definition.nextExpectedRunAt = wrapper.definition.nextRun;
    wrapper.definition.runtimeActive = true;
    await this.heartbeatService.markScheduled(key, wrapper.definition.nextExpectedRunAt || null);
  }

  private async buildRuntimeSnapshot(): Promise<CronJobDefinition[]> {
    const definitions = Array.from(this.jobs.values()).map((wrapper) => {
      if (wrapper.job) {
        wrapper.definition.nextRun = this.safeNextRun(wrapper.job);
      }

      const definition = { ...wrapper.definition };
      definition.nextExpectedRunAt = definition.nextRun;
      definition.runtimeRegistered = wrapper.runtimeRegistered;
      definition.runtimeActive = Boolean(wrapper.job);
      definition.sourceOfTruth = 'database';
      definition.issue = wrapper.runtimeRegistered ? null : 'runtime_not_registered';
      return definition;
    });

    const heartbeatMap = await this.heartbeatService.list(definitions.map((definition) => definition.key));

    return definitions
      .map((definition) => {
        this.applyHeartbeat(definition, heartbeatMap.get(definition.key));
        return definition;
      })
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  private buildBaseDefinition(
    key: string,
    input: {
      name: string;
      description: string;
      schedule: string;
      enabled: boolean;
      settingsUrl?: string;
      origin?: 'core' | 'modulo';
      editable?: boolean;
      watchdogEnabled?: boolean;
      watchdogStaleAfterMs?: number;
      watchdogStuckAfterMs?: number;
      idempotent?: boolean;
    },
    runtimeRegistered: boolean,
  ): CronJobDefinition {
    return {
      key,
      name: input.name,
      description: input.description,
      schedule: input.schedule,
      enabled: input.enabled,
      settingsUrl: input.settingsUrl,
      origin: input.origin,
      editable: input.editable,
      idempotent: input.idempotent,
      runtimeRegistered,
      runtimeActive: false,
      sourceOfTruth: 'database',
      lastStatus: 'idle',
      consecutiveFailureCount: 0,
      issue: runtimeRegistered ? null : 'runtime_not_registered',
      watchdogEnabled: input.watchdogEnabled !== false,
      watchdogStaleAfterMs: input.watchdogStaleAfterMs,
      watchdogStuckAfterMs: input.watchdogStuckAfterMs,
    };
  }

  private applyHeartbeat(
    definition: CronJobDefinition,
    heartbeat?: CronJobHeartbeatRecord | null,
  ): void {
    if (!heartbeat) {
      definition.lastRun = definition.lastStartedAt;
      return;
    }

    definition.lastStartedAt = heartbeat.lastStartedAt || undefined;
    definition.lastHeartbeatAt = heartbeat.lastHeartbeatAt || undefined;
    definition.lastSucceededAt = heartbeat.lastSucceededAt || undefined;
    definition.lastFailedAt = heartbeat.lastFailedAt || undefined;
    definition.lastDurationMs = heartbeat.lastDurationMs ?? undefined;
    definition.lastStatus = heartbeat.lastStatus;
    definition.lastError = heartbeat.lastError || undefined;
    definition.nextExpectedRunAt = heartbeat.nextExpectedRunAt || definition.nextExpectedRunAt;
    definition.consecutiveFailureCount = heartbeat.consecutiveFailureCount;
    definition.lastRun = definition.lastStartedAt;
  }

  private async executeRegisteredJob(
    key: string,
    modulo: string,
    identificador: string,
    callback: () => Promise<void> | void,
    definition: CronJobDefinition,
    job: CronJob | undefined,
    options: {
      reason: 'scheduled' | 'manual';
      respectEnabledCheck: boolean;
      rethrowOnFailure: boolean;
    },
  ): Promise<void> {
    if (this.maintenancePaused && options.reason === 'scheduled') {
      this.logger.log(`[EXECUTION_SKIPPED] Job ${key} pausado por maintenance mode de restore`);
      return;
    }

    // 0. Obter dados determinísticos para cycleId
    const heartbeat = await this.heartbeatService.get(key);
    
    let cycleId = `manual-${Date.now()}`;
    if (options.reason !== 'manual') {
      if (heartbeat?.nextExpectedRunAt) {
        cycleId = heartbeat.nextExpectedRunAt.getTime().toString();
      } else {
        const intervalMs = this.estimateIntervalMs(definition.schedule);
        const nextRun = this.safeNextRun(job);
        if (nextRun && intervalMs) {
          cycleId = (nextRun.getTime() - intervalMs).toString();
        } else {
          cycleId = `fallback-${Math.floor(Date.now() / 60000) * 60000}`;
        }
      }
    }
    
    // instanceId (PM2_INSTANCE ou Hostname)
    const instanceId = process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || 'single-instance';

    // 1. Cooldown Redundante Removido

    // 2. Verificação de status ativo (Banco)
    if (options.respectEnabledCheck) {
      const current = await this.prisma.cronSchedule.findUnique({
        where: { modulo_identificador: { modulo, identificador } },
      });

      if (!current || !current.ativo) {
        this.logger.log(`[EXECUTION_SKIPPED] Job ${key} ignorado (desativado no banco).`);
        return;
      }
    }

    // 3. Modo Degradado (Check)
    const isDegraded = this.redisLock.isDegraded();
    if (isDegraded) {
      this.logger.warn(`[DEGRADED_MODE_EXEC] Redis offline no ciclo ${cycleId} do job ${key}.`);
    }

    // 4. Lock por Ciclo distribuído
    const lockKey = `cron:cycle:${key}:${cycleId}`;
    const intervalMs = this.estimateIntervalMs(definition.schedule) || 60000;
    const lockTtlMs = intervalMs + 30000; 
    
    let lockAcquired = false;
    if (!isDegraded) {
      lockAcquired = await this.redisLock.acquireLock(lockKey, lockTtlMs, instanceId);
    } else {
      const isIdempotent = definition.idempotent !== false; 
      if (isIdempotent) {
        this.logger.warn(`[DEGRADED_MODE_EXEC] Job ${key} é idempotente. Prosseguindo com DB Guard.`);
        lockAcquired = true;
      } else {
        this.logger.error(`[DEGRADED_MODE_ABORT] Job ${key} crítico com riscos de concorrência. Abortando.`);
        return;
      }
    }

    if (!lockAcquired) {
      this.logger.log(`[LOCK_DENIED] Job ${key} concorrente rejeitado. cycleId=${cycleId} instanceId=${instanceId}`);
      return;
    }

    this.logger.log(`[LOCK_ACQUIRED] Job ${key} ciclo=${cycleId} instanceId=${instanceId}`);

    const startedAt = new Date();
    const nextExpectedRunAt = this.resolveNextExpectedRun(job);

    definition.lastStartedAt = startedAt;
    definition.lastRun = startedAt;
    definition.lastStatus = 'running';

    // 5. Atualização de Status no Banco (Exclusive Guard)
    const stuckAfterMs = definition.watchdogStuckAfterMs || 15 * 60 * 1000; 
    const startedStatus = await this.heartbeatService.markStarted(
      key, 
      startedAt, 
      nextExpectedRunAt || null, 
      cycleId, 
      instanceId,
      stuckAfterMs
    );

    if (!startedStatus) {
      this.logger.warn(`[DB_SYNC_FAILED_ABORT] Job ${key} bloqueado pelo Exclusive Guard. cycleId=${cycleId}`);
      return;
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        await this.heartbeatService.updateHeartbeat(key);
      } catch (err) {
        this.logger.warn(`[HEARTBEAT_FAILED] Falha ao atualizar heartbeat para ${key}`);
      }
    }, 30000);

    try {
      this.logger.log(`[EXECUTION_STARTED] Executando callback do cron job: ${key}`);
      await callback();

      const finishedAt = new Date();
      const nextRun = this.resolveNextExpectedRun(job);

      definition.lastStatus = 'success';
      definition.lastSucceededAt = finishedAt;
      definition.lastDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      definition.consecutiveFailureCount = 0;

      await this.heartbeatService.markSuccess(key, startedAt, finishedAt, nextRun || null);
      this.logger.log(`[EXECUTION_FINISHED] Job ${key} concluído com sucesso.`);
    } catch (error) {
      const finishedAt = new Date();
      const nextRun = this.resolveNextExpectedRun(job);

      definition.lastStatus = 'failed';
      definition.lastFailedAt = finishedAt;
      definition.lastDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
      definition.consecutiveFailureCount = (definition.consecutiveFailureCount || 0) + 1;

      await this.heartbeatService.markFailure(key, startedAt, finishedAt, error, nextRun || null);
      this.logger.error(`Erro ao executar cron job ${key}:`, error);
      if (options.rethrowOnFailure) {
        throw error;
      }
    } finally {
      clearInterval(heartbeatInterval);
      definition.nextRun = this.resolveNextExpectedRun(job);
      definition.nextExpectedRunAt = definition.nextRun;
    }
  }

  private deleteCronJobOnly(key: string): void {
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

  private resolveNextExpectedRun(job?: CronJob): Date | undefined {
    if (!job) {
      return undefined;
    }
    return this.safeNextRun(job);
  }

  private estimateIntervalMs(schedule: string): number | null {
    try {
      const probe = new CronJob(schedule, () => undefined);
      const dates = probe.nextDates(2);
      if (!Array.isArray(dates) || dates.length < 2) {
        return null;
      }
      const first = dates[0].toJSDate().getTime();
      const second = dates[1].toJSDate().getTime();
      return second - first;
    } catch {
      return null;
    }
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim().slice(0, 500);
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim().slice(0, 500);
    }

    return 'Falha desconhecida';
  }
}
