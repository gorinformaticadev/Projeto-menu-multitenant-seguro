import { Injectable, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CronJobDefinition, CronService } from '../../core/cron/cron.service';
import { CronJobHeartbeatService } from '../../core/cron/cron-job-heartbeat.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';

type WatchdogAlertInput = {
  action: 'JOB_NOT_RUNNING' | 'JOB_REPEATED_FAILURES' | 'JOB_STUCK_RUNNING';
  cooldownKey: string;
  severity: 'warning' | 'critical';
  title: string;
  body: string;
  data: Record<string, unknown>;
  pushEligible?: boolean;
  audit?: boolean;
};

const DEFAULT_WATCHDOG_FAILURE_THRESHOLD = 3;
const DEFAULT_WATCHDOG_MIN_STALE_MS = 5 * 60 * 1000;
const DEFAULT_WATCHDOG_MAX_STALE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_WATCHDOG_MIN_STUCK_MS = 10 * 60 * 1000;
const DEFAULT_WATCHDOG_MAX_STUCK_MS = 6 * 60 * 60 * 1000;

import { RedisLockService } from './redis-lock.service';

@Injectable()
export class SystemJobWatchdogService implements OnModuleInit {
  constructor(
    private readonly cronService: CronService,
    private readonly heartbeatService: CronJobHeartbeatService,
    private readonly systemOperationalAlertsService: SystemOperationalAlertsService,
    private readonly configResolver: ConfigResolverService,
    private readonly redisLock: RedisLockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cronService.register(
      'system.job_watchdog_evaluator',
      CronExpression.EVERY_MINUTE,
      async () => {
        await this.evaluateWatchdog();
      },
      {
        name: 'Job watchdog evaluator',
        description: 'Monitora jobs agendados e alerta quando eles atrasam, travam ou falham repetidamente.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
        watchdogEnabled: false,
      },
    );
  }

  async evaluateWatchdog(
    now = new Date(),
  ): Promise<{ emitted: string[]; skipped: string[] }> {
    const instanceId = process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || 'single-instance';
    const lockKey = 'watchdog:evaluator:lock';
    
    // Evitar que multiplas instancias rodem o evaluator ao mesmo tempo
    const lockAcquired = await this.redisLock.acquireLock(lockKey, 50000, instanceId); // 50s TTL
    if (!lockAcquired) {
      return { emitted: [], skipped: ['locked_by_other_instance'] };
    }

    try {
      if (this.cronService.isMaintenancePaused()) {
        return {
          emitted: [],
          skipped: ['maintenance_paused'],
        };
      }

    if (!(await this.isWatchdogEnabled())) {
      return {
        emitted: [],
        skipped: ['watchdog_disabled'],
      };
    }

    // Limpa jobs órfãos/travados antes de avaliar status
    try {
      await this.heartbeatService.reconcileOrphans();
    } catch (error) {
      // Já logado internamente
    }

    const jobs = await this.cronService.getRuntimeJobs();
    const emitted: string[] = [];
    const skipped: string[] = [];
    const nowMs = now.getTime();

    for (const job of jobs) {
      if (!job.enabled || job.watchdogEnabled === false) {
        continue;
      }

      if (job.key === 'system.job_watchdog_evaluator') {
        continue;
      }

      if (!job.runtimeRegistered) {
        if (
          await this.emitWatchdogAlert(
            {
              action: 'JOB_NOT_RUNNING',
              cooldownKey: `JOB_NOT_RUNNING:${job.key}`,
              severity: 'critical',
              title: 'Job nao registrado no runtime',
              body: `O job ${job.name} esta configurado, mas nao foi registrado no runtime.`,
              pushEligible: true,
              audit: true,
              data: this.buildJobData(job, {
                reason: 'runtime_not_registered',
              }),
            },
            nowMs,
          )
        ) {
          emitted.push(`JOB_NOT_RUNNING:${job.key}`);
        } else {
          skipped.push(`JOB_NOT_RUNNING:${job.key}`);
        }
        continue;
      }

      const intervalMs = this.estimateIntervalMs(job.schedule);
      const staleAfterMs = job.watchdogStaleAfterMs || this.resolveStaleThreshold(intervalMs);
      const stuckAfterMs = job.watchdogStuckAfterMs || this.resolveStuckThreshold(intervalMs);

      if (this.isJobStuck(job, nowMs, stuckAfterMs)) {
        if (
          await this.emitWatchdogAlert(
            {
              action: 'JOB_STUCK_RUNNING',
              cooldownKey: `JOB_STUCK_RUNNING:${job.key}`,
              severity: 'critical',
              title: 'Job travado em execucao',
              body: `O job ${job.name} ficou em execucao por mais tempo do que o esperado.`,
              pushEligible: true,
              audit: true,
              data: this.buildJobData(job, {
                stuckAfterMs,
                intervalMs,
              }),
            },
            nowMs,
          )
        ) {
          emitted.push(`JOB_STUCK_RUNNING:${job.key}`);
        } else {
          skipped.push(`JOB_STUCK_RUNNING:${job.key}`);
        }
        continue;
      }

      if (this.isJobRepeatedFailure(job)) {
        if (
          await this.emitWatchdogAlert(
            {
              action: 'JOB_REPEATED_FAILURES',
              cooldownKey: `JOB_REPEATED_FAILURES:${job.key}`,
              severity: 'warning',
              title: 'Falhas repetidas em job',
              body: `O job ${job.name} falhou repetidamente nas ultimas execucoes.`,
              data: this.buildJobData(job, {
                threshold: this.readRepeatedFailureThreshold(),
              }),
            },
            nowMs,
          )
        ) {
          emitted.push(`JOB_REPEATED_FAILURES:${job.key}`);
        } else {
          skipped.push(`JOB_REPEATED_FAILURES:${job.key}`);
        }
        continue;
      }

      if (this.isJobStale(job, nowMs, staleAfterMs)) {
        if (
          await this.emitWatchdogAlert(
            {
              action: 'JOB_NOT_RUNNING',
              cooldownKey: `JOB_NOT_RUNNING:${job.key}`,
              severity: 'critical',
              title: 'Job atrasado',
              body: `O job ${job.name} nao executou no prazo esperado.`,
              pushEligible: true,
              audit: true,
              data: this.buildJobData(job, {
                staleAfterMs,
                intervalMs,
                reason: job.lastStartedAt ? 'overdue' : 'never_ran',
              }),
            },
            nowMs,
          )
        ) {
          emitted.push(`JOB_NOT_RUNNING:${job.key}`);
        } else {
          skipped.push(`JOB_NOT_RUNNING:${job.key}`);
        }
        continue;
      }

      skipped.push(`healthy:${job.key}`);
    }

    return { emitted, skipped };
    } finally {
      await this.redisLock.releaseLock(lockKey, instanceId);
    }
  }

  private isJobRepeatedFailure(job: CronJobDefinition): boolean {
    const failureCount = Number(job.consecutiveFailureCount || 0);
    if (failureCount < this.readRepeatedFailureThreshold()) {
      return false;
    }

    if (!job.lastFailedAt) {
      return false;
    }

    if (job.lastSucceededAt && job.lastSucceededAt >= job.lastFailedAt) {
      return false;
    }

    return true;
  }

  private isJobStuck(job: CronJobDefinition, nowMs: number, stuckAfterMs: number): boolean {
    if (job.lastStatus !== 'running' || !job.lastStartedAt) {
      return false;
    }

    const referenceTime = job.lastHeartbeatAt ? job.lastHeartbeatAt.getTime() : job.lastStartedAt.getTime();
    return nowMs - referenceTime > stuckAfterMs;
  }

  private isJobStale(job: CronJobDefinition, nowMs: number, staleAfterMs: number): boolean {
    if (!job.nextExpectedRunAt) {
      return false;
    }

    if (job.lastStatus === 'running') {
      return false;
    }

    return nowMs > job.nextExpectedRunAt.getTime() + staleAfterMs;
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
      const intervalMs = second - first;

      if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        return null;
      }

      return intervalMs;
    } catch {
      return null;
    }
  }

  private resolveStaleThreshold(intervalMs: number | null): number {
    if (!intervalMs || intervalMs <= 0) {
      return DEFAULT_WATCHDOG_MIN_STALE_MS;
    }

    return Math.min(
      DEFAULT_WATCHDOG_MAX_STALE_MS,
      Math.max(DEFAULT_WATCHDOG_MIN_STALE_MS, intervalMs * 2),
    );
  }

  private resolveStuckThreshold(intervalMs: number | null): number {
    if (!intervalMs || intervalMs <= 0) {
      return DEFAULT_WATCHDOG_MIN_STUCK_MS;
    }

    return Math.min(
      DEFAULT_WATCHDOG_MAX_STUCK_MS,
      Math.max(DEFAULT_WATCHDOG_MIN_STUCK_MS, intervalMs),
    );
  }

  private buildJobData(
    job: CronJobDefinition,
    extra: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      jobKey: job.key,
      jobName: job.name,
      schedule: job.schedule,
      lastStatus: job.lastStatus || 'idle',
      lastStartedAt: job.lastStartedAt?.toISOString() || null,
      lastSucceededAt: job.lastSucceededAt?.toISOString() || null,
      lastFailedAt: job.lastFailedAt?.toISOString() || null,
      nextExpectedRunAt: job.nextExpectedRunAt?.toISOString() || null,
      consecutiveFailureCount: job.consecutiveFailureCount || 0,
      issue: job.issue || null,
      ...extra,
    };
  }

  private async emitWatchdogAlert(input: WatchdogAlertInput, nowMs: number): Promise<boolean> {
    return this.systemOperationalAlertsService.dispatchOperationalAlert(
      {
        action: input.action,
        cooldownKey: input.cooldownKey,
        severity: input.severity,
        title: input.title,
        body: input.body,
        data: input.data,
        pushEligible: input.pushEligible,
        audit: input.audit,
        source: 'job-watchdog',
      },
      nowMs,
    );
  }

  private async isWatchdogEnabled(): Promise<boolean> {
    return (await this.configResolver.getBoolean('operations.watchdog.enabled')) !== false;
  }

  private readRepeatedFailureThreshold(): number {
    const raw = Number.parseInt(String(process.env.CRON_WATCHDOG_REPEATED_FAILURE_THRESHOLD || ''), 10);
    if (!Number.isFinite(raw) || raw <= 1) {
      return DEFAULT_WATCHDOG_FAILURE_THRESHOLD;
    }

    return Math.min(raw, 50);
  }
}
