import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Prisma } from '@prisma/client';
import { RedisLockService } from '../../common/services/redis-lock.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CronJobHeartbeatRecord,
  CronJobHeartbeatService,
  CronJobHeartbeatStatus,
  CronJobHeartbeatWriteFailureReason,
} from './cron-job-heartbeat.service';
import {
  ExecutionLeaseFailureReason,
  ExecutionLeaseRecord,
  ExecutionLeaseService,
} from './execution-lease.service';
import type { MaterializedCronExecutionStatus } from './materialized-cron-execution.service';

export interface CronJobDatabaseLeaseOptions {
  enabled?: boolean;
  ttlMs?: number;
  renewIntervalMs?: number;
}

export type CronJobExecutionMode = 'direct' | 'materialized';

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
  databaseLease?: CronJobDatabaseLeaseOptions;
  executionMode?: CronJobExecutionMode;
}

export interface CronJobExecutionContext {
  reason: 'scheduled' | 'manual';
  cycleId: string;
  instanceId: string;
  signal: AbortSignal;
  lease?:
    | {
        jobKey: string;
        ownerId: string;
        cycleId: string;
        leaseVersion: bigint;
      }
    | undefined;
  assertLeaseOwnership(stage?: string): Promise<void>;
  throwIfAborted(): void;
}

type CronJobCallback = (context?: CronJobExecutionContext) => Promise<void> | void;

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
  databaseLease?: CronJobDatabaseLeaseOptions;
  executionMode?: CronJobExecutionMode;
};

type JobWrapper = {
  definition: CronJobDefinition;
  callback: CronJobCallback;
  job?: CronJob;
  runtimeRegistered: boolean;
};

type CronJobCycleTerminalStatus = 'success' | 'failed' | 'skipped' | 'superseded';
type PersistedHeartbeatTerminalStatus = Extract<CronJobHeartbeatStatus, 'success' | 'failed' | 'skipped'>;

type MaterializedRuntimeSnapshotRow = {
  jobKey: string;
  scheduledFor: Date;
  triggeredAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: MaterializedCronExecutionStatus;
  heartbeatAt: Date | null;
  reason: string | null;
  error: string | null;
  updatedAt: Date;
};

type MaterializedRuntimeSnapshot = {
  latest: MaterializedRuntimeSnapshotRow | null;
  latestSuccess: MaterializedRuntimeSnapshotRow | null;
  latestFailure: MaterializedRuntimeSnapshotRow | null;
  consecutiveFailureCount: number;
};

type MaterializedFailureCountRow = {
  jobKey: string;
  consecutiveFailureCount: number | bigint | null;
};

const DEFAULT_DATABASE_LEASE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_DATABASE_LEASE_RENEW_MS = 30 * 1000;

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
    private readonly executionLeaseService: ExecutionLeaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Inicializando Cron Service...');
    await this.heartbeatService.reconcileOrphans();
    await this.syncWithDatabase();
  }

  async register(
    key: string,
    schedule: string,
    callback: CronJobCallback,
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
        databaseLease: meta.databaseLease,
        executionMode: meta.executionMode,
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
    callback: CronJobCallback,
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

    const directJobKeys = definitions
      .filter((definition) => definition.executionMode !== 'materialized')
      .map((definition) => definition.key);
    const materializedJobKeys = definitions
      .filter((definition) => definition.executionMode === 'materialized')
      .map((definition) => definition.key);

    const [heartbeatMap, materializedSnapshots] = await Promise.all([
      directJobKeys.length > 0
        ? this.heartbeatService.list(directJobKeys)
        : Promise.resolve(new Map<string, CronJobHeartbeatRecord>()),
      this.loadMaterializedExecutionSnapshots(materializedJobKeys),
    ]);

    return definitions
      .map((definition) => {
        if (definition.executionMode === 'materialized') {
          this.applyMaterializedExecutionSnapshot(
            definition,
            materializedSnapshots.get(definition.key) || null,
          );
          return definition;
        }

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
      databaseLease?: CronJobDatabaseLeaseOptions;
      executionMode?: CronJobExecutionMode;
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
      databaseLease: input.databaseLease,
      executionMode: input.executionMode || 'direct',
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
    if (definition.executionMode !== 'materialized') {
      definition.nextExpectedRunAt = heartbeat.nextExpectedRunAt || definition.nextExpectedRunAt;
    }
    definition.consecutiveFailureCount = heartbeat.consecutiveFailureCount;
    definition.lastRun = definition.lastStartedAt;
  }

  private async loadMaterializedExecutionSnapshots(
    jobKeys: string[],
  ): Promise<Map<string, MaterializedRuntimeSnapshot>> {
    if (jobKeys.length === 0) {
      return new Map();
    }

    const snapshots = new Map<string, MaterializedRuntimeSnapshot>(
      jobKeys.map((jobKey) => [
        jobKey,
        {
          latest: null,
          latestSuccess: null,
          latestFailure: null,
          consecutiveFailureCount: 0,
        },
      ]),
    );

    try {
      const [latestRows, latestSuccessRows, latestFailureRows, failureCountRows] = await Promise.all([
        this.prisma.$queryRaw<MaterializedRuntimeSnapshotRow[]>(Prisma.sql`
          SELECT DISTINCT ON ("jobKey")
            "jobKey",
            "scheduledFor",
            "triggeredAt",
            "startedAt",
            "finishedAt",
            "status",
            "heartbeatAt",
            "reason",
            "error",
            "updatedAt"
          FROM "cron_materialized_executions"
          WHERE "jobKey" IN (${Prisma.join(jobKeys)})
          ORDER BY "jobKey", "scheduledFor" DESC, "updatedAt" DESC
        `),
        this.prisma.$queryRaw<MaterializedRuntimeSnapshotRow[]>(Prisma.sql`
          SELECT DISTINCT ON ("jobKey")
            "jobKey",
            "scheduledFor",
            "triggeredAt",
            "startedAt",
            "finishedAt",
            "status",
            "heartbeatAt",
            "reason",
            "error",
            "updatedAt"
          FROM "cron_materialized_executions"
          WHERE "jobKey" IN (${Prisma.join(jobKeys)})
            AND "status" = 'success'
          ORDER BY "jobKey", "scheduledFor" DESC, "updatedAt" DESC
        `),
        this.prisma.$queryRaw<MaterializedRuntimeSnapshotRow[]>(Prisma.sql`
          SELECT DISTINCT ON ("jobKey")
            "jobKey",
            "scheduledFor",
            "triggeredAt",
            "startedAt",
            "finishedAt",
            "status",
            "heartbeatAt",
            "reason",
            "error",
            "updatedAt"
          FROM "cron_materialized_executions"
          WHERE "jobKey" IN (${Prisma.join(jobKeys)})
            AND "status" IN ('failed', 'aborted')
          ORDER BY "jobKey", "scheduledFor" DESC, "updatedAt" DESC
        `),
        this.prisma.$queryRaw<MaterializedFailureCountRow[]>(Prisma.sql`
          WITH ranked_executions AS (
            SELECT
              "jobKey",
              "status",
              SUM(CASE WHEN "status" = 'success' THEN 1 ELSE 0 END) OVER (
                PARTITION BY "jobKey"
                ORDER BY "scheduledFor" DESC, "updatedAt" DESC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS "successSeen"
            FROM "cron_materialized_executions"
            WHERE "jobKey" IN (${Prisma.join(jobKeys)})
          )
          SELECT
            "jobKey",
            COUNT(*) FILTER (WHERE "status" IN ('failed', 'aborted'))::int AS "consecutiveFailureCount"
          FROM ranked_executions
          WHERE "successSeen" = 0
          GROUP BY "jobKey"
        `),
      ]);

      for (const row of latestRows) {
        const current = snapshots.get(row.jobKey);
        if (current) {
          current.latest = row;
        }
      }

      for (const row of latestSuccessRows) {
        const current = snapshots.get(row.jobKey);
        if (current) {
          current.latestSuccess = row;
        }
      }

      for (const row of latestFailureRows) {
        const current = snapshots.get(row.jobKey);
        if (current) {
          current.latestFailure = row;
        }
      }

      for (const row of failureCountRows) {
        const current = snapshots.get(row.jobKey);
        if (current) {
          current.consecutiveFailureCount = Number(row.consecutiveFailureCount || 0);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao montar snapshot materializado dos cron jobs: ${String(error)}`,
      );
    }

    return snapshots;
  }

  private applyMaterializedExecutionSnapshot(
    definition: CronJobDefinition,
    snapshot?: MaterializedRuntimeSnapshot | null,
  ): void {
    definition.lastRun = undefined;
    definition.lastStartedAt = undefined;
    definition.lastHeartbeatAt = undefined;
    definition.lastSucceededAt = undefined;
    definition.lastFailedAt = undefined;
    definition.lastDurationMs = undefined;
    definition.lastStatus = 'idle';
    definition.lastError = undefined;
    definition.consecutiveFailureCount = 0;

    const latest = snapshot?.latest;
    if (!latest) {
      return;
    }

    definition.lastStartedAt = latest.startedAt || undefined;
    definition.lastHeartbeatAt = latest.heartbeatAt || undefined;
    definition.lastSucceededAt =
      this.resolveMaterializedTerminalAt(snapshot?.latestSuccess) || undefined;
    definition.lastFailedAt =
      this.resolveMaterializedTerminalAt(snapshot?.latestFailure) || undefined;
    definition.lastDurationMs = this.resolveMaterializedDurationMs(latest);
    definition.lastStatus = this.mapMaterializedStatus(latest.status);
    definition.lastError = this.resolveMaterializedError(latest);
    definition.consecutiveFailureCount = snapshot?.consecutiveFailureCount || 0;
    definition.lastRun = definition.lastStartedAt;
  }

  private mapMaterializedStatus(status: MaterializedCronExecutionStatus): CronJobHeartbeatStatus {
    switch (status) {
      case 'running':
        return 'running';
      case 'success':
        return 'success';
      case 'failed':
      case 'aborted':
        return 'failed';
      case 'skipped':
      case 'superseded':
        return 'skipped';
      case 'pending':
      default:
        return 'idle';
    }
  }

  private resolveMaterializedTerminalAt(
    execution?: MaterializedRuntimeSnapshotRow | null,
  ): Date | null {
    if (!execution) {
      return null;
    }

    return execution.finishedAt || execution.updatedAt;
  }

  private resolveMaterializedDurationMs(
    execution: MaterializedRuntimeSnapshotRow,
  ): number | undefined {
    const reference = execution.finishedAt || execution.heartbeatAt;
    if (!execution.startedAt || !reference) {
      return undefined;
    }

    return Math.max(0, reference.getTime() - execution.startedAt.getTime());
  }

  private resolveMaterializedError(
    execution: MaterializedRuntimeSnapshotRow,
  ): string | undefined {
    if (execution.status === 'success' || execution.status === 'running' || execution.status === 'pending') {
      return undefined;
    }

    return execution.error || execution.reason || undefined;
  }

  private resolveDatabaseLeaseOptions(
    definition: CronJobDefinition,
  ): Required<CronJobDatabaseLeaseOptions> | null {
    if (definition.databaseLease?.enabled !== true) {
      return null;
    }

    return {
      enabled: true,
      ttlMs: Math.max(
        1,
        Math.floor(definition.databaseLease.ttlMs || DEFAULT_DATABASE_LEASE_TTL_MS),
      ),
      renewIntervalMs: Math.max(
        1,
        Math.floor(definition.databaseLease.renewIntervalMs || DEFAULT_DATABASE_LEASE_RENEW_MS),
      ),
    };
  }

  private mergeExecutionErrors(primary: unknown, secondary: unknown): Error {
    const primaryMessage = primary instanceof Error ? primary.message : String(primary);
    const secondaryMessage = secondary instanceof Error ? secondary.message : String(secondary);
    return new Error(`${primaryMessage}; lease=${secondaryMessage}`);
  }

  private normalizeLifecycleReason(reason: unknown): string {
    if (reason instanceof Error && reason.message.trim()) {
      return reason.message.trim().slice(0, 500);
    }

    if (typeof reason === 'string' && reason.trim()) {
      return reason.trim().slice(0, 500);
    }

    return 'Ciclo encerrado sem motivo informado.';
  }

  private isPersistedHeartbeatTerminalStatus(
    status: CronJobHeartbeatStatus | null | undefined,
  ): status is PersistedHeartbeatTerminalStatus {
    return status === 'success' || status === 'failed' || status === 'skipped';
  }

  private resolveObservedCycleTerminalStatus(
    heartbeat: CronJobHeartbeatRecord | null,
    cycleId: string,
    instanceId: string,
  ): PersistedHeartbeatTerminalStatus | null {
    if (!heartbeat) {
      return null;
    }

    if (heartbeat.cycleId !== cycleId || heartbeat.instanceId !== instanceId) {
      return null;
    }

    if (!this.isPersistedHeartbeatTerminalStatus(heartbeat.lastStatus)) {
      return null;
    }

    return heartbeat.lastStatus;
  }

  private describeHeartbeatRecord(heartbeat: CronJobHeartbeatRecord | null): string {
    if (!heartbeat) {
      return 'heartbeat=absent';
    }

    return [
      `heartbeatStatus=${heartbeat.lastStatus}`,
      `heartbeatCycleId=${heartbeat.cycleId || 'unknown'}`,
      `heartbeatInstanceId=${heartbeat.instanceId || 'unknown'}`,
      `heartbeatLastStartedAt=${heartbeat.lastStartedAt?.toISOString() || 'null'}`,
      `heartbeatLastHeartbeatAt=${heartbeat.lastHeartbeatAt?.toISOString() || 'null'}`,
      `heartbeatNextExpectedRunAt=${heartbeat.nextExpectedRunAt?.toISOString() || 'null'}`,
    ].join(' ');
  }

  private buildTerminalPersistenceError(
    key: string,
    cycleId: string,
    instanceId: string,
    stage: string,
    intendedStatus: Exclude<CronJobCycleTerminalStatus, 'superseded'>,
    reason: CronJobHeartbeatWriteFailureReason | null,
    cause?: unknown,
  ): Error {
    const error = new Error(
      `Falha ao persistir estado terminal ${intendedStatus} de ${key}. cycleId=${cycleId} instanceId=${instanceId} stage=${stage} reason=${reason || 'unknown'} cause=${this.normalizeErrorMessage(cause)}`,
    );
    error.name = 'CronTerminalizationError';
    return error;
  }

  private resolveFallbackTerminalStatus(
    failureReason: CronJobHeartbeatWriteFailureReason | null,
    heartbeat: CronJobHeartbeatRecord | null,
    cycleId: string,
    instanceId: string,
    error?: unknown,
  ): CronJobCycleTerminalStatus {
    if (this.isLeaseOwnershipLostError(error) || failureReason === 'stale_execution') {
      return 'superseded';
    }

    if (heartbeat && (heartbeat.cycleId !== cycleId || heartbeat.instanceId !== instanceId)) {
      return 'superseded';
    }

    return 'failed';
  }

  private async persistCycleTerminalFallback(params: {
    key: string;
    cycleId: string;
    instanceId: string;
    stage: string;
    intendedStatus: Exclude<CronJobCycleTerminalStatus, 'superseded'>;
    terminalStatus: CronJobCycleTerminalStatus;
    failureReason: CronJobHeartbeatWriteFailureReason | null;
    startedAt: Date;
    finishedAt: Date;
    nextExpectedRunAt: Date | null;
    error?: unknown;
    observedHeartbeat?: CronJobHeartbeatRecord | null;
  }): Promise<void> {
    const normalizedError = this.normalizeErrorMessage(params.error);
    const observedHeartbeat = params.observedHeartbeat || null;

    if (params.failureReason === 'stale_execution' || params.terminalStatus === 'superseded') {
      this.logger.warn(
        `[TERMINAL_REJECTED_BY_OWNERSHIP] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} intended=${params.intendedStatus} stage=${params.stage} reason=${params.failureReason || 'unknown'} ${this.describeHeartbeatRecord(observedHeartbeat)}`,
      );
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_CYCLE_TERMINAL_FALLBACK',
          severity: params.terminalStatus === 'failed' ? 'error' : 'warning',
          message: `Job ${params.key} encerrou o ciclo ${params.cycleId} com terminal fallback ${params.terminalStatus}.`,
          details: normalizedError,
          metadata: {
            jobKey: params.key,
            cycleId: params.cycleId,
            instanceId: params.instanceId,
            stage: params.stage,
            intendedTerminalStatus: params.intendedStatus,
            persistedTerminalStatus: params.terminalStatus,
            heartbeatWriteFailureReason: params.failureReason,
            startedAt: params.startedAt.toISOString(),
            finishedAt: params.finishedAt.toISOString(),
            nextExpectedRunAt: params.nextExpectedRunAt?.toISOString() || null,
            observedHeartbeat: observedHeartbeat
              ? {
                  lastStatus: observedHeartbeat.lastStatus,
                  cycleId: observedHeartbeat.cycleId || null,
                  instanceId: observedHeartbeat.instanceId || null,
                  lastStartedAt: observedHeartbeat.lastStartedAt?.toISOString() || null,
                  lastHeartbeatAt: observedHeartbeat.lastHeartbeatAt?.toISOString() || null,
                  nextExpectedRunAt: observedHeartbeat.nextExpectedRunAt?.toISOString() || null,
                }
              : null,
            error: normalizedError,
          },
        },
      });

      this.logger.warn(
        `[TERMINAL_FALLBACK_PERSISTED] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} intended=${params.intendedStatus} terminal=${params.terminalStatus} stage=${params.stage}`,
      );
    } catch (fallbackError) {
      this.logger.error(
        `[TERMINAL_FALLBACK_FAILED] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} intended=${params.intendedStatus} terminal=${params.terminalStatus} stage=${params.stage} error=${String(fallbackError)}`,
      );
    }
  }

  private applyTerminalStateToDefinition(
    definition: CronJobDefinition,
    status: PersistedHeartbeatTerminalStatus,
    startedAt: Date,
    finishedAt: Date,
    error?: unknown,
  ): void {
    definition.lastStartedAt = startedAt;
    definition.lastRun = startedAt;
    definition.lastDurationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    if (status === 'success') {
      definition.lastStatus = 'success';
      definition.lastSucceededAt = finishedAt;
      definition.lastError = undefined;
      definition.consecutiveFailureCount = 0;
      return;
    }

    if (status === 'skipped') {
      definition.lastStatus = 'skipped';
      definition.lastError = this.normalizeLifecycleReason(error || 'SKIPPED');
      return;
    }

    definition.lastStatus = 'failed';
    definition.lastFailedAt = finishedAt;
    definition.lastError = this.normalizeErrorMessage(error);
    definition.consecutiveFailureCount = (definition.consecutiveFailureCount || 0) + 1;
  }

  private async ensureStartedCycleTerminalState(params: {
    key: string;
    cycleId: string;
    instanceId: string;
    startedAt: Date;
    finishedAt: Date;
    nextExpectedRunAt: Date | null;
    intendedStatus: Exclude<CronJobCycleTerminalStatus, 'superseded'>;
    writeFailureReason: CronJobHeartbeatWriteFailureReason | null;
    error?: unknown;
    stage: string;
  }): Promise<CronJobCycleTerminalStatus> {
    const observedBeforeFallback = await this.heartbeatService.get(params.key);
    const observedTerminal = this.resolveObservedCycleTerminalStatus(
      observedBeforeFallback,
      params.cycleId,
      params.instanceId,
    );

    if (observedTerminal) {
      this.logger.warn(
        `[TERMINAL_ALREADY_PERSISTED] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} stage=${params.stage} status=${observedTerminal}`,
      );
      return observedTerminal;
    }

    const fallbackStatusBeforeRetry = this.resolveFallbackTerminalStatus(
      params.writeFailureReason,
      observedBeforeFallback,
      params.cycleId,
      params.instanceId,
      params.error,
    );

    if (fallbackStatusBeforeRetry === 'superseded') {
      await this.persistCycleTerminalFallback({
        ...params,
        terminalStatus: 'superseded',
        failureReason: params.writeFailureReason,
        observedHeartbeat: observedBeforeFallback,
      });
      return 'superseded';
    }

    const fallbackError = this.buildTerminalPersistenceError(
      params.key,
      params.cycleId,
      params.instanceId,
      params.stage,
      params.intendedStatus,
      params.writeFailureReason,
      params.error,
    );

    const failedFallback = await this.heartbeatService.markFailure(
      params.key,
      params.startedAt,
      params.finishedAt,
      fallbackError,
      params.nextExpectedRunAt,
      params.cycleId,
      params.instanceId,
    );

    if (failedFallback.persisted) {
      this.logger.error(
        `[TERMINAL_FALLBACK_TO_FAILED] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} intended=${params.intendedStatus} stage=${params.stage}`,
      );
      return 'failed';
    }

    const observedAfterFallback = await this.heartbeatService.get(params.key);
    const observedTerminalAfterFallback = this.resolveObservedCycleTerminalStatus(
      observedAfterFallback,
      params.cycleId,
      params.instanceId,
    );

    if (observedTerminalAfterFallback) {
      this.logger.warn(
        `[TERMINAL_ALREADY_PERSISTED] Job ${params.key} cycleId=${params.cycleId} instanceId=${params.instanceId} stage=${params.stage}:fallback status=${observedTerminalAfterFallback}`,
      );
      return observedTerminalAfterFallback;
    }

    const fallbackStatus = this.resolveFallbackTerminalStatus(
      failedFallback.reason || params.writeFailureReason,
      observedAfterFallback,
      params.cycleId,
      params.instanceId,
      fallbackError,
    );

    await this.persistCycleTerminalFallback({
      ...params,
      terminalStatus: fallbackStatus,
      failureReason: failedFallback.reason || params.writeFailureReason,
      error: fallbackError,
      observedHeartbeat: observedAfterFallback,
    });

    return fallbackStatus;
  }

  private isLeaseOwnershipFailure(reason: ExecutionLeaseFailureReason | null | undefined): boolean {
    return Boolean(reason && reason !== 'database_error');
  }

  private isLeaseOwnershipLostError(error: unknown): boolean {
    return error instanceof Error && error.name === 'LeaseOwnershipLostError';
  }

  private describeLeaseRecord(lease: ExecutionLeaseRecord | null): string {
    if (!lease) {
      return 'lease=absent';
    }
    return [
      `ownerId=${lease.ownerId}`,
      `cycleId=${lease.cycleId}`,
      `leaseVersion=${lease.leaseVersion.toString()}`,
      `status=${lease.status}`,
      `lockedUntil=${lease.lockedUntil.toISOString()}`,
    ].join(' ');
  }

  private buildLeaseOwnershipLostError(
    key: string,
    cycleId: string,
    instanceId: string,
    stage: string,
    reason: ExecutionLeaseFailureReason | null,
    lease: ExecutionLeaseRecord | null,
  ): Error {
    const error = new Error(
      `Lease persistido de ${key} foi perdido em ${stage}. cycleId=${cycleId} instanceId=${instanceId} reason=${reason || 'unknown'} ${this.describeLeaseRecord(lease)}`,
    );
    error.name = 'LeaseOwnershipLostError';
    return error;
  }

  private resolveInstanceId(): string {
    const runtimeParts = [
      String(process.env.NODE_APP_INSTANCE || '').trim(),
      String(process.env.HOSTNAME || process.env.COMPUTERNAME || '').trim(),
      `pid-${process.pid}`,
    ].filter((part) => part.length > 0);

    if (runtimeParts.length === 0) {
      return 'single-instance';
    }

    return runtimeParts.join(':');
  }

  private resolveMaterializedCycleId(
    definition: CronJobDefinition,
    job: CronJob | undefined,
    reason: 'scheduled' | 'manual',
  ): string {
    if (reason === 'manual') {
      return `manual-${Date.now()}`;
    }

    const intervalMs = this.estimateIntervalMs(definition.schedule);
    const nextRun = this.safeNextRun(job);

    if (nextRun && intervalMs) {
      return (nextRun.getTime() - intervalMs).toString();
    }

    return `fallback-${Math.floor(Date.now() / 60000) * 60000}`;
  }

  private async executeMaterializedDispatchJob(
    key: string,
    modulo: string,
    identificador: string,
    callback: CronJobCallback,
    definition: CronJobDefinition,
    job: CronJob | undefined,
    options: {
      reason: 'scheduled' | 'manual';
      respectEnabledCheck: boolean;
      rethrowOnFailure: boolean;
    },
  ): Promise<void> {
    const cycleId = this.resolveMaterializedCycleId(definition, job, options.reason);
    const instanceId = this.resolveInstanceId();

    if (this.maintenancePaused && options.reason === 'scheduled') {
      this.logger.log(
        `[MATERIALIZED_DISPATCH_SKIPPED] Job ${key} ignorado por maintenance mode. cycleId=${cycleId}`,
      );
      return;
    }

    if (options.respectEnabledCheck) {
      const current = await this.prisma.cronSchedule.findUnique({
        where: { modulo_identificador: { modulo, identificador } },
      });

      if (!current || !current.ativo) {
        this.logger.log(
          `[MATERIALIZED_DISPATCH_SKIPPED] Job ${key} ignorado porque o agendamento esta desativado. cycleId=${cycleId}`,
        );
        return;
      }
    }

    const executionContext: CronJobExecutionContext = {
      reason: options.reason,
      cycleId,
      instanceId,
      signal: new AbortController().signal,
      lease: undefined,
      assertLeaseOwnership: async () => undefined,
      throwIfAborted: () => undefined,
    };

    try {
      this.logger.log(
        `[MATERIALIZED_DISPATCH_TRIGGERED] Job ${key} cycleId=${cycleId} instanceId=${instanceId}`,
      );
      await callback(executionContext);
    } catch (error) {
      this.logger.error(
        `[MATERIALIZED_DISPATCH_FAILED] Job ${key} cycleId=${cycleId} instanceId=${instanceId}`,
        error as Error,
      );

      if (options.rethrowOnFailure) {
        throw error;
      }
    } finally {
      definition.nextRun = this.resolveNextExpectedRun(job);
      definition.nextExpectedRunAt = definition.nextRun;
    }
  }

  private async executeRegisteredJob(
    key: string,
    modulo: string,
    identificador: string,
    callback: CronJobCallback,
    definition: CronJobDefinition,
    job: CronJob | undefined,
    options: {
      reason: 'scheduled' | 'manual';
      respectEnabledCheck: boolean;
      rethrowOnFailure: boolean;
    },
  ): Promise<void> {
    // 0. Obter dados determinísticos para cycleId
    if (definition.executionMode === 'materialized') {
      await this.executeMaterializedDispatchJob(
        key,
        modulo,
        identificador,
        callback,
        definition,
        job,
        options,
      );
      return;
    }

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
    const instanceId = this.resolveInstanceId();
    const startedAt = new Date();
    const nextExpectedRunAt = this.resolveNextExpectedRun(job);

    // Lock preventivo para evitar que duas instâncias iniciem o mesmo ciclo simultaneamente
    const preLockKey = `cron:prelock:${key}:${cycleId}`;
    const hasPreLock = await this.redisLock.acquireLock(preLockKey, 30000, instanceId);
    if (!hasPreLock && options.reason !== 'manual') {
      this.logger.warn(`[PRE_LOCK_DENIED] Job ${key} já está sendo processado por outra instância. cycleId=${cycleId}`);
      return;
    }

    let cycleEnteredRunning = false;

    const persistSkippedCycle = async (reason: string, error?: unknown): Promise<boolean> => {
      const finishedAt = new Date();
      const normalizedReason = this.normalizeLifecycleReason(error || reason);
      let terminalStatus: CronJobCycleTerminalStatus = 'skipped';
      const skipped = await this.heartbeatService.markSkipped(
        key,
        startedAt,
        finishedAt,
        normalizedReason,
        nextExpectedRunAt || null,
        cycleId,
        instanceId,
      );

      if (skipped.persisted) {
        this.applyTerminalStateToDefinition(definition, 'skipped', startedAt, finishedAt, normalizedReason);
      } else {
        this.logger.warn(
          `[EXECUTION_SKIP_NOT_PERSISTED] Job ${key} nao conseguiu registrar skipped. cycleId=${cycleId} instanceId=${instanceId} reason=${normalizedReason} failureReason=${skipped.reason || 'unknown'}`,
        );

        if (cycleEnteredRunning) {
          terminalStatus = await this.ensureStartedCycleTerminalState({
            key,
            cycleId,
            instanceId,
            startedAt,
            finishedAt,
            nextExpectedRunAt: nextExpectedRunAt || null,
            intendedStatus: 'skipped',
            writeFailureReason: skipped.reason,
            error: normalizedReason,
            stage: 'markSkipped',
          });
          this.applyHeartbeat(definition, await this.heartbeatService.get(key));
        }
      }

      if (terminalStatus === 'skipped') {
        this.logger.log(
          `[EXECUTION_SKIPPED] Job ${key} cycleId=${cycleId} instanceId=${instanceId} reason=${normalizedReason}`,
        );
      } else {
        this.logger.warn(
          `[EXECUTION_TERMINALIZED_WITH_FALLBACK] Job ${key} cycleId=${cycleId} instanceId=${instanceId} terminal=${terminalStatus} reason=${normalizedReason}`,
        );
      }
      return skipped.persisted;
    };

    // 1. Cooldown Redundante Removido

    if (this.maintenancePaused && options.reason === 'scheduled') {
      await persistSkippedCycle('MAINTENANCE_PAUSED');
      this.logger.log(`[EXECUTION_SKIPPED] Job ${key} pausado por maintenance mode de restore`);
      return;
    }

    // 2. Verificação de status ativo (Banco)
    if (options.respectEnabledCheck) {
      const current = await this.prisma.cronSchedule.findUnique({
        where: { modulo_identificador: { modulo, identificador } },
      });

      if (!current || !current.ativo) {
        await persistSkippedCycle('JOB_DISABLED');
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
        await persistSkippedCycle('DEGRADED_MODE_ABORT');
        this.logger.error(`[DEGRADED_MODE_ABORT] Job ${key} crítico com riscos de concorrência. Abortando.`);
        return;
      }
    }

    if (!lockAcquired) {
      await persistSkippedCycle('LOCK_DENIED');
      this.logger.log(`[LOCK_DENIED] Job ${key} concorrente rejeitado. cycleId=${cycleId} instanceId=${instanceId}`);
      return;
    }

    this.logger.log(`[LOCK_ACQUIRED] Job ${key} ciclo=${cycleId} instanceId=${instanceId}`);

    const leaseOptions = this.resolveDatabaseLeaseOptions(definition);
    const leaseContext = leaseOptions
      ? {
          jobKey: key,
          ownerId: instanceId,
          cycleId,
        }
      : null;
    let leaseReleased = leaseContext === null;
    let leaseVersion: bigint | null = null;
    let leaseLostError: Error | null = null;
    let finalizationStarted = false;
    const leaseAbortController = new AbortController();

    const markLeaseLost = (
      stage: string,
      reason: ExecutionLeaseFailureReason | null,
      lease: ExecutionLeaseRecord | null,
    ): Error => {
      if (leaseLostError) {
        return leaseLostError;
      }
      leaseLostError = this.buildLeaseOwnershipLostError(
        key,
        cycleId,
        instanceId,
        stage,
        reason,
        lease,
      );
      if (!leaseAbortController.signal.aborted) {
        leaseAbortController.abort();
      }
      this.logger.error(
        `[DB_LEASE_LOST] Job ${key} cycleId=${cycleId} instanceId=${instanceId} stage=${stage} reason=${reason || 'unknown'} ${this.describeLeaseRecord(lease)}`,
      );
      return leaseLostError;
    };

    const throwIfAborted = (): void => {
      if (leaseLostError) {
        throw leaseLostError;
      }
      if (leaseAbortController.signal.aborted) {
        const abortedError = new Error(
          `Execucao de ${key} foi abortada por perda do lease persistido. cycleId=${cycleId} instanceId=${instanceId}`,
        );
        abortedError.name = 'LeaseOwnershipLostError';
        throw abortedError;
      }
    };

    const assertLeaseOwnership = async (stage: string): Promise<void> => {
      throwIfAborted();
      if (!leaseContext || leaseVersion === null) {
        return;
      }
      const ownership = await this.executionLeaseService.assertLeaseOwnership({
        ...leaseContext,
        leaseVersion,
      });
      if (!ownership.owned) {
        throw markLeaseLost(stage, ownership.reason, ownership.lease);
      }
    };

    const executionContext: CronJobExecutionContext = {
      reason: options.reason,
      cycleId,
      instanceId,
      signal: leaseAbortController.signal,
      lease: undefined,
      assertLeaseOwnership,
      throwIfAborted,
    };

    const releaseLease = async (reason: string, releasedAt: Date, error?: unknown): Promise<void> => {
      if (!leaseContext || leaseReleased || leaseVersion === null) {
        return;
      }

      const released = await this.executionLeaseService.releaseLease({
        ...leaseContext,
        leaseVersion,
        releasedAt,
        reason,
        error,
      });

      if (!released.released) {
        if (this.isLeaseOwnershipFailure(released.reason)) {
          throw markLeaseLost(`release:${reason}`, released.reason, released.lease);
        }
        throw new Error(
          `Lease persistido de ${key} nao foi liberado por ownerId=${instanceId} cycleId=${cycleId} leaseVersion=${leaseVersion.toString()}.`,
        );
      }

      leaseReleased = true;
      this.logger.log(
        `[DB_LEASE_RELEASED] Job ${key} cycleId=${cycleId} instanceId=${instanceId} leaseVersion=${leaseVersion.toString()} reason=${reason}`,
      );
    };

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
      await persistSkippedCycle('HEARTBEAT_GUARD_DENIED');
      this.logger.warn(`[DB_SYNC_FAILED_ABORT] Job ${key} bloqueado pelo Exclusive Guard. cycleId=${cycleId}`);
      return;
    }

    definition.lastStartedAt = startedAt;
    definition.lastRun = startedAt;
    definition.lastStatus = 'running';
    definition.lastError = undefined;
    cycleEnteredRunning = true;

    if (leaseContext && leaseOptions) {
      const acquisition = await this.executionLeaseService.acquireLease({
        ...leaseContext,
        startedAt,
        ttlMs: leaseOptions.ttlMs,
      });

      if (!acquisition.acquired) {
        const activeLease = acquisition.lease;
        await persistSkippedCycle(
          `DB_LEASE_DENIED ownerId=${activeLease?.ownerId || 'unknown'} cycleId=${activeLease?.cycleId || 'unknown'} leaseVersion=${activeLease?.leaseVersion?.toString() || 'unknown'}`,
        );
        this.logger.log(
          `[DB_LEASE_DENIED] Job ${key} bloqueado por lease ativo. ownerId=${activeLease?.ownerId || 'unknown'} cycleId=${activeLease?.cycleId || 'unknown'} leaseVersion=${activeLease?.leaseVersion?.toString() || 'unknown'} lockedUntil=${activeLease?.lockedUntil?.toISOString() || 'unknown'}`,
        );
        return;
      }

      leaseVersion = acquisition.lease?.leaseVersion || null;
      if (leaseVersion === null) {
        throw new Error(`Acquire do lease persistido de ${key} nao retornou leaseVersion.`);
      }

      executionContext.lease = {
        jobKey: leaseContext.jobKey,
        ownerId: leaseContext.ownerId,
        cycleId: leaseContext.cycleId,
        leaseVersion,
      };

      this.logger.log(
        `[DB_LEASE_ACQUIRED] Job ${key} cycleId=${cycleId} instanceId=${instanceId} leaseVersion=${leaseVersion.toString()} mode=${leaseVersion > 1n ? 'takeover' : 'initial'} lockedUntil=${acquisition.lease?.lockedUntil?.toISOString() || 'unknown'}`,
      );
    }

    const heartbeatTickMs = leaseOptions
      ? Math.min(DEFAULT_DATABASE_LEASE_RENEW_MS, leaseOptions.renewIntervalMs)
      : DEFAULT_DATABASE_LEASE_RENEW_MS;

    const heartbeatInterval = setInterval(async () => {
      if (finalizationStarted || leaseReleased) {
        return;
      }

      const heartbeatUpdated = await this.heartbeatService.updateHeartbeat(key, cycleId, instanceId);
      if (!heartbeatUpdated && !leaseLostError) {
        const observedLease = leaseContext ? await this.executionLeaseService.get(key) : null;
        markLeaseLost('heartbeat_guard', 'stale_execution', observedLease);
        return;
      }

      if (leaseContext && leaseOptions && !leaseReleased && leaseVersion !== null) {
        const renewed = await this.executionLeaseService.renewLease({
          ...leaseContext,
          leaseVersion,
          ttlMs: leaseOptions.ttlMs,
        });

        if (!renewed.renewed && !leaseLostError) {
          markLeaseLost('renew', renewed.reason, renewed.lease);
        }
      }
    }, heartbeatTickMs);

    try {
      this.logger.log(`[EXECUTION_STARTED] Executando callback do cron job: ${key}`);
      await assertLeaseOwnership('before_callback');
      await callback(executionContext);
      throwIfAborted();
      if (leaseLostError) {
        throw leaseLostError;
      }

      const finishedAt = new Date();
      const nextRun = this.resolveNextExpectedRun(job);
      finalizationStarted = true;

      await releaseLease('completed', finishedAt);

      const successPersisted = await this.heartbeatService.markSuccess(
        key,
        startedAt,
        finishedAt,
        nextRun || null,
        cycleId,
        instanceId,
      );
      if (successPersisted.persisted) {
        this.applyTerminalStateToDefinition(definition, 'success', startedAt, finishedAt);
        this.logger.log(`[EXECUTION_FINISHED] Job ${key} concluido com sucesso.`);
        return;
      }
      const resolvedTerminal = await this.ensureStartedCycleTerminalState({
        key,
        cycleId,
        instanceId,
        startedAt,
        finishedAt,
        nextExpectedRunAt: nextRun || null,
        intendedStatus: 'success',
        writeFailureReason: successPersisted.reason,
        stage: 'markSuccess',
      });

      if (resolvedTerminal !== 'superseded') {
        this.applyTerminalStateToDefinition(definition, resolvedTerminal, startedAt, finishedAt);
      } else {
        this.applyHeartbeat(definition, await this.heartbeatService.get(key));
      }

      this.logger.warn(
        `[EXECUTION_FINISHED_WITH_FALLBACK] Job ${key} cycleId=${cycleId} instanceId=${instanceId} terminal=${resolvedTerminal}`,
      );
    } catch (error) {
      const finishedAt = new Date();
      const nextRun = this.resolveNextExpectedRun(job);
      let finalError = leaseLostError || error;
      finalizationStarted = true;

      if (
        leaseContext &&
        !leaseReleased &&
        leaseVersion !== null &&
        !this.isLeaseOwnershipLostError(finalError)
      ) {
        try {
          await releaseLease('failed', finishedAt, finalError);
        } catch (leaseError) {
          if (this.isLeaseOwnershipLostError(leaseError)) {
            finalError = leaseError;
          } else {
            finalError = this.mergeExecutionErrors(finalError, leaseError);
            this.logger.error(
              `[DB_LEASE_RELEASE_FAILED] Job ${key} falhou ao liberar lease persistido: ${String(leaseError)}`,
            );
          }
        }
      }

      const failurePersisted = await this.heartbeatService.markFailure(
        key,
        startedAt,
        finishedAt,
        finalError,
        nextRun || null,
        cycleId,
        instanceId,
      );

      if (failurePersisted.persisted) {
        this.applyTerminalStateToDefinition(definition, 'failed', startedAt, finishedAt, finalError);
      } else {
        const resolvedTerminal = await this.ensureStartedCycleTerminalState({
          key,
          cycleId,
          instanceId,
          startedAt,
          finishedAt,
          nextExpectedRunAt: nextRun || null,
          intendedStatus: 'failed',
          writeFailureReason: failurePersisted.reason,
          error: finalError,
          stage: 'markFailure',
        });

        if (resolvedTerminal !== 'superseded') {
          this.applyTerminalStateToDefinition(definition, resolvedTerminal, startedAt, finishedAt, finalError);
        } else {
          this.applyHeartbeat(definition, await this.heartbeatService.get(key));
        }

        this.logger.warn(
          `[EXECUTION_FAILED_WITH_FALLBACK] Job ${key} cycleId=${cycleId} instanceId=${instanceId} terminal=${resolvedTerminal}`,
        );
      }
      this.logger.error(`Erro ao executar cron job ${key}:`, finalError);
      if (options.rethrowOnFailure) {
        throw finalError;
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
