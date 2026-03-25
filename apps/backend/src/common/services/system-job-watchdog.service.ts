import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CronJobDefinition, CronService } from '../../core/cron/cron.service';
import { CronJobHeartbeatService } from '../../core/cron/cron-job-heartbeat.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import {
  SessionCleanupExecutionService,
  SessionCleanupWatchdogSnapshot,
} from './session-cleanup-execution.service';
import {
  OperationalAlertRecord,
  SystemOperationalAlertsService,
} from './system-operational-alerts.service';

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
const MATERIALIZED_ALERT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

import { RedisLockService } from './redis-lock.service';

@Injectable()
export class SystemJobWatchdogService implements OnModuleInit {
  private readonly logger = new Logger(SystemJobWatchdogService.name);

  constructor(
    private readonly cronService: CronService,
    private readonly heartbeatService: CronJobHeartbeatService,
    private readonly systemOperationalAlertsService: SystemOperationalAlertsService,
    private readonly configResolver: ConfigResolverService,
    private readonly redisLock: RedisLockService,
    private readonly sessionCleanupExecutionService: SessionCleanupExecutionService,
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

      if (this.isMaterializedSessionCleanup(job)) {
        const materializedEvaluation = await this.evaluateMaterializedSessionCleanup(
          job,
          now,
          nowMs,
          intervalMs,
          staleAfterMs,
          stuckAfterMs,
        );

        if (materializedEvaluation.emitted) {
          emitted.push(materializedEvaluation.emitted);
        } else {
          skipped.push(materializedEvaluation.skipped);
        }
        continue;
      }

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

  private isMaterializedSessionCleanup(job: CronJobDefinition): boolean {
    return (
      job.key === SessionCleanupExecutionService.JOB_KEY &&
      job.executionMode === 'materialized'
    );
  }

  private async evaluateMaterializedSessionCleanup(
    job: CronJobDefinition,
    now: Date,
    nowMs: number,
    intervalMs: number | null,
    staleAfterMs: number,
    stuckAfterMs: number,
  ): Promise<{ emitted?: string; skipped: string }> {
    const expectedSnapshot = await this.sessionCleanupExecutionService.inspectExpectedExecution({
      schedule: job.schedule,
      now,
      staleAfterMs,
      stuckAfterMs,
    });
    const latestSnapshot = await this.sessionCleanupExecutionService.inspectLatestExecution({
      now,
      stuckAfterMs,
      timeZone: expectedSnapshot.scheduleTimeZone,
    });
    const openAlerts = await this.findOpenMaterializedAlerts(now);
    const resolvedAlertIds = await this.resolveMaterializedAlertsIfNeeded(
      job,
      openAlerts,
      latestSnapshot,
      now,
    );
    const activeOpenAlerts = openAlerts.filter(
      (alert) => !resolvedAlertIds.includes(alert.id),
    );

    if (
      expectedSnapshot.state === 'stuck' &&
      !this.isMaterializedSnapshotCurrentlyStuck(latestSnapshot)
    ) {
      this.logMaterializedClassification(
        'SESSION_CLEANUP_STUCK_DISCARDED',
        'stale_expected_slot_snapshot',
        expectedSnapshot.execution,
        expectedSnapshot,
        {
          latestExecutionId: latestSnapshot.execution?.id || null,
          latestState: latestSnapshot.state,
          latestStatus: latestSnapshot.execution?.status || null,
        },
      );
    }

    if (this.isMaterializedSnapshotCurrentlyStuck(latestSnapshot)) {
      const initialExecution = latestSnapshot.execution;
      if (!initialExecution) {
        return {
          skipped: `healthy:${job.key}`,
        };
      }

      const revalidationNow = new Date();
      const revalidatedSnapshot =
        await this.sessionCleanupExecutionService.inspectExecutionById({
          executionId: initialExecution.id,
          now: revalidationNow,
          stuckAfterMs,
          timeZone: latestSnapshot.scheduleTimeZone,
        });

      if (!this.isMaterializedSnapshotCurrentlyStuck(revalidatedSnapshot)) {
        this.logMaterializedClassification(
          'SESSION_CLEANUP_STUCK_DISCARDED',
          'revalidation_not_stuck',
          revalidatedSnapshot.execution || initialExecution,
          revalidatedSnapshot,
          {
            latestExecutionId: latestSnapshot.execution?.id || null,
            latestState: revalidatedSnapshot.state,
          },
        );

        await this.resolveMaterializedAlertsIfNeeded(
          job,
          activeOpenAlerts,
          revalidatedSnapshot,
          now,
        );

        return {
          skipped: `healthy:${job.key}`,
        };
      }

      const fingerprint = this.buildMaterializedAlertFingerprint(
        job.key,
        revalidatedSnapshot,
      );

      if (
        this.hasOpenAlertForFingerprint(
          activeOpenAlerts,
          'JOB_STUCK_RUNNING',
          fingerprint,
        )
      ) {
        this.logMaterializedClassification(
          'SESSION_CLEANUP_STUCK_DEDUPED',
          'open_alert_for_same_execution',
          revalidatedSnapshot.execution,
          revalidatedSnapshot,
          {
            alertFingerprint: fingerprint,
          },
        );

        return {
          skipped: `JOB_STUCK_RUNNING:${job.key}:${fingerprint}`,
        };
      }

      this.logMaterializedClassification(
        'SESSION_CLEANUP_STUCK_CLASSIFIED',
        'latest_execution_stuck',
        revalidatedSnapshot.execution,
        revalidatedSnapshot,
        {
          alertFingerprint: fingerprint,
        },
      );

      const emitted = await this.emitWatchdogAlert(
        {
          action: 'JOB_STUCK_RUNNING',
          cooldownKey: `JOB_STUCK_RUNNING:${fingerprint}`,
          severity: 'critical',
          title: 'Job travado em execucao',
          body: `O job ${job.name} ficou em execucao por mais tempo do que o esperado.`,
          pushEligible: true,
          audit: true,
          data: this.buildMaterializedJobData(job, revalidatedSnapshot, {
            stuckAfterMs,
            intervalMs,
            alertFingerprint: fingerprint,
            alertLifecycle: 'open',
          }),
        },
        nowMs,
      );

      return {
        emitted: emitted ? `JOB_STUCK_RUNNING:${job.key}` : undefined,
        skipped: emitted
          ? `healthy:${job.key}`
          : `JOB_STUCK_RUNNING:${job.key}:${fingerprint}`,
      };
    }

    if (
      (expectedSnapshot.state === 'not_created' || expectedSnapshot.state === 'pending') &&
      expectedSnapshot.isOverdue
    ) {
      const revalidationNow = new Date();
      const revalidatedExpectedSnapshot =
        await this.sessionCleanupExecutionService.inspectExpectedExecution({
          schedule: job.schedule,
          now: revalidationNow,
          staleAfterMs,
          stuckAfterMs,
          timeZone: expectedSnapshot.scheduleTimeZone,
        });

      if (
        !(
          (revalidatedExpectedSnapshot.state === 'not_created' ||
            revalidatedExpectedSnapshot.state === 'pending') &&
          revalidatedExpectedSnapshot.isOverdue
        )
      ) {
        this.logMaterializedClassification(
          'SESSION_CLEANUP_OVERDUE_DISCARDED',
          'revalidation_not_overdue',
          revalidatedExpectedSnapshot.execution,
          revalidatedExpectedSnapshot,
          {},
        );

        return {
          skipped: `healthy:${job.key}`,
        };
      }

      const fingerprint = this.buildMaterializedAlertFingerprint(
        job.key,
        revalidatedExpectedSnapshot,
      );

      if (
        this.hasOpenAlertForFingerprint(
          activeOpenAlerts,
          'JOB_NOT_RUNNING',
          fingerprint,
        )
      ) {
        return {
          skipped: `JOB_NOT_RUNNING:${job.key}:${fingerprint}`,
        };
      }

      const emitted = await this.emitWatchdogAlert(
        {
          action: 'JOB_NOT_RUNNING',
          cooldownKey: `JOB_NOT_RUNNING:${fingerprint}`,
          severity: 'critical',
          title: 'Job atrasado',
          body: `O job ${job.name} nao executou no prazo esperado.`,
          pushEligible: true,
          audit: true,
          data: this.buildMaterializedJobData(job, revalidatedExpectedSnapshot, {
            staleAfterMs,
            intervalMs,
            reason: revalidatedExpectedSnapshot.reason,
            alertFingerprint: fingerprint,
            alertLifecycle: 'open',
          }),
        },
        nowMs,
      );

      return {
        emitted: emitted ? `JOB_NOT_RUNNING:${job.key}` : undefined,
        skipped: emitted
          ? `healthy:${job.key}`
          : `JOB_NOT_RUNNING:${job.key}:${fingerprint}`,
      };
    }

    return {
      skipped: `healthy:${job.key}`,
    };
  }

  private buildJobData(
    job: CronJobDefinition,
    extra: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      jobKey: job.key,
      jobName: job.name,
      schedule: job.schedule,
      executionMode: job.executionMode || 'direct',
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

  private buildMaterializedJobData(
    job: CronJobDefinition,
    snapshot: SessionCleanupWatchdogSnapshot,
    extra: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      jobKey: job.key,
      jobName: job.name,
      schedule: job.schedule,
      executionMode: job.executionMode || 'direct',
      sourceOfTruth: 'materialized_execution',
      scheduleTimeZone: snapshot.scheduleTimeZone,
      slotResolutionErrorCode: snapshot.slotResolutionErrorCode,
      slotResolutionError: snapshot.slotResolutionError,
      slotResolutionWindowMs: snapshot.slotResolutionWindowMs,
      slotResolutionMaxOccurrences: snapshot.slotResolutionMaxOccurrences,
      slotResolutionEstimatedIntervalMs: snapshot.slotResolutionEstimatedIntervalMs,
      slotResolutionCadence: snapshot.slotResolutionCadence,
      watchdogState: snapshot.state,
      watchdogReason: snapshot.reason,
      expectedScheduledFor: snapshot.expectedScheduledFor?.toISOString() || null,
      materializedExecutionId: snapshot.execution?.id || null,
      materializedExecutionStatus: snapshot.execution?.status || null,
      materializedExecutionOwnerId: snapshot.execution?.ownerId || null,
      materializedExecutionAttempt: snapshot.execution?.attempt || null,
      materializedExecutionLeaseVersion: snapshot.execution?.leaseVersion?.toString() || null,
      materializedExecutionTriggeredAt: snapshot.execution?.triggeredAt?.toISOString() || null,
      materializedExecutionStartedAt: snapshot.execution?.startedAt?.toISOString() || null,
      materializedExecutionFinishedAt: snapshot.execution?.finishedAt?.toISOString() || null,
      materializedExecutionHeartbeatAt: snapshot.execution?.heartbeatAt?.toISOString() || null,
      materializedExecutionLockedUntil: snapshot.execution?.lockedUntil?.toISOString() || null,
      materializedExecutionReason: snapshot.execution?.reason || null,
      materializedExecutionError: snapshot.execution?.error || null,
      materializedLatestExecutionId: snapshot.latestExecution?.id || null,
      materializedLatestExecutionStatus: snapshot.latestExecution?.status || null,
      materializedLatestScheduledFor: snapshot.latestExecution?.scheduledFor?.toISOString() || null,
      materializedLatestFinishedAt: snapshot.latestExecution?.finishedAt?.toISOString() || null,
      isOverdue: snapshot.isOverdue,
      isStuck: snapshot.isStuck,
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

  private async findOpenMaterializedAlerts(now: Date): Promise<OperationalAlertRecord[]> {
    const alerts = await this.systemOperationalAlertsService.findRecentOperationalAlerts({
      source: 'job-watchdog',
      since: new Date(now.getTime() - MATERIALIZED_ALERT_LOOKBACK_MS),
      limit: 250,
    });

    return alerts.filter((alert) => {
      const action = this.readAlertDataString(alert.data, 'alertAction');
      const jobKey = this.readAlertDataString(alert.data, 'jobKey');
      const resolvedAt = this.readAlertDataString(alert.data, 'alertResolvedAt');
      return (
        jobKey === SessionCleanupExecutionService.JOB_KEY &&
        (action === 'JOB_STUCK_RUNNING' || action === 'JOB_NOT_RUNNING') &&
        !resolvedAt
      );
    });
  }

  private async resolveMaterializedAlertsIfNeeded(
    job: CronJobDefinition,
    openAlerts: OperationalAlertRecord[],
    latestSnapshot: SessionCleanupWatchdogSnapshot,
    now: Date,
  ): Promise<string[]> {
    const latestExecution = latestSnapshot.execution;
    if (!latestExecution || !this.isTerminalMaterializedState(latestSnapshot.state)) {
      return [];
    }

    const latestScheduledForMs = latestExecution.scheduledFor.getTime();
    const latestExecutionId = latestExecution.id;
    const idsToResolve = openAlerts
      .filter((alert) => {
        const alertExecutionId = this.readAlertDataString(
          alert.data,
          'materializedExecutionId',
        );
        const alertScheduledFor = this.readAlertDataDate(
          alert.data,
          'expectedScheduledFor',
        );
        const alertScheduledForMs = alertScheduledFor?.getTime();

        if (alertExecutionId && alertExecutionId === latestExecutionId) {
          return true;
        }

        return typeof alertScheduledForMs === 'number' &&
          Number.isFinite(alertScheduledForMs) &&
          alertScheduledForMs <= latestScheduledForMs;
      })
      .map((alert) => alert.id);

    if (idsToResolve.length === 0) {
      return [];
    }

    const resolutionReason = idsToResolve.some((id) => {
      const alert = openAlerts.find((candidate) => candidate.id === id);
      const alertExecutionId = this.readAlertDataString(
        alert?.data || null,
        'materializedExecutionId',
      );
      return alertExecutionId === latestExecutionId;
    })
      ? 'terminal_state_observed'
      : 'newer_terminal_execution_observed';

    const resolved = await this.systemOperationalAlertsService.resolveOperationalAlerts({
      ids: idsToResolve,
      resolution: {
        alertLifecycle: 'resolved',
        alertResolvedReason: resolutionReason,
        resolutionSource: 'job-watchdog',
        resolutionObservedAt: now.toISOString(),
        resolvedByJobKey: job.key,
        resolvedByExecutionId: latestExecution.id,
        resolvedByScheduledFor: latestExecution.scheduledFor.toISOString(),
        resolvedByStatus: latestExecution.status,
        resolvedByFinishedAt: latestExecution.finishedAt?.toISOString() || null,
      },
      markAsRead: true,
    });

    if (resolved > 0) {
      this.logMaterializedClassification(
        'SESSION_CLEANUP_ALERTS_RESOLVED',
        resolutionReason,
        latestExecution,
        latestSnapshot,
        {
          resolvedAlertCount: resolved,
        },
      );
    }

    return resolved === idsToResolve.length ? idsToResolve : [];
  }

  private isMaterializedSnapshotCurrentlyStuck(
    snapshot: SessionCleanupWatchdogSnapshot,
  ): boolean {
    const execution = snapshot.execution;
    return Boolean(
      execution &&
        snapshot.state === 'stuck' &&
        execution.status === 'running' &&
        execution.finishedAt === null,
    );
  }

  private isTerminalMaterializedState(state: SessionCleanupWatchdogSnapshot['state']): boolean {
    return (
      state === 'success' ||
      state === 'failed' ||
      state === 'skipped' ||
      state === 'superseded' ||
      state === 'aborted'
    );
  }

  private hasOpenAlertForFingerprint(
    alerts: OperationalAlertRecord[],
    action: 'JOB_NOT_RUNNING' | 'JOB_STUCK_RUNNING',
    fingerprint: string,
  ): boolean {
    return alerts.some((alert) => {
      const alertAction = this.readAlertDataString(alert.data, 'alertAction');
      const alertFingerprint = this.readAlertDataString(alert.data, 'alertFingerprint');
      return alertAction === action && alertFingerprint === fingerprint;
    });
  }

  private buildMaterializedAlertFingerprint(
    jobKey: string,
    snapshot: SessionCleanupWatchdogSnapshot,
  ): string {
    const scheduledFor = snapshot.execution?.scheduledFor || snapshot.expectedScheduledFor;
    const scheduledForIso = scheduledFor?.toISOString() || 'unknown-slot';
    const executionId = snapshot.execution?.id;
    return executionId
      ? `${jobKey}:${executionId}:${scheduledForIso}`
      : `${jobKey}:${scheduledForIso}`;
  }

  private readAlertDataString(
    data: Record<string, unknown> | null,
    key: string,
  ): string | null {
    const value = data?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private readAlertDataDate(
    data: Record<string, unknown> | null,
    key: string,
  ): Date | null {
    const value = this.readAlertDataString(data, key);
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private logMaterializedClassification(
    event: string,
    reason: string,
    execution: SessionCleanupWatchdogSnapshot['execution'],
    snapshot: SessionCleanupWatchdogSnapshot,
    extra: Record<string, unknown>,
  ): void {
    const payload = {
      jobKey: SessionCleanupExecutionService.JOB_KEY,
      executionId: execution?.id || null,
      scheduledFor:
        execution?.scheduledFor?.toISOString() ||
        snapshot.expectedScheduledFor?.toISOString() ||
        null,
      status: execution?.status || null,
      heartbeatAt: execution?.heartbeatAt?.toISOString() || null,
      lockedUntil: execution?.lockedUntil?.toISOString() || null,
      finishedAt: execution?.finishedAt?.toISOString() || null,
      watchdogState: snapshot.state,
      watchdogReason: snapshot.reason,
      classificationReason: reason,
      ...extra,
    };

    if (event === 'SESSION_CLEANUP_STUCK_CLASSIFIED') {
      this.logger.warn(`[${event}] ${JSON.stringify(payload)}`);
      return;
    }

    this.logger.log(`[${event}] ${JSON.stringify(payload)}`);
  }
}
