import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CronTime } from 'cron';
import type { CronJobExecutionContext } from '@core/cron/cron.service';
import { MaterializedCronExecutionFailureReason, MaterializedCronExecutionRecord, MaterializedCronExecutionService, MaterializedCronExecutionStatus } from '@core/cron/materialized-cron-execution.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { SessionCleanupProcessorService } from './session-cleanup-processor.service';

export type SessionCleanupWatchdogState =
  | 'not_created'
  | 'pending'
  | 'running'
  | 'stuck'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'superseded'
  | 'aborted';

export interface SessionCleanupWatchdogSnapshot {
  expectedScheduledFor: Date | null;
  execution: MaterializedCronExecutionRecord | null;
  latestExecution: MaterializedCronExecutionRecord | null;
  state: SessionCleanupWatchdogState;
  isOverdue: boolean;
  isStuck: boolean;
  reason: string;
  scheduleTimeZone: string;
  slotResolutionErrorCode: string | null;
  slotResolutionError: string | null;
  slotResolutionWindowMs: number | null;
  slotResolutionMaxOccurrences: number | null;
  slotResolutionEstimatedIntervalMs: number | null;
  slotResolutionCadence: string | null;
}

type RuntimeExecutionClassification = {
  state: SessionCleanupWatchdogState;
  isStuck: boolean;
  reason: string;
  heartbeatStale: boolean;
  lockExpired: boolean;
};

type ExpectedSlotSearchCadence = 'subdaily' | 'daily' | 'weekly' | 'monthly';

type ExpectedSlotResolutionErrorCode =
  | 'invalid_schedule'
  | 'interval_estimation_failed'
  | 'unsupported_schedule_interval'
  | 'slot_outside_resolution_window'
  | 'occurrence_limit_exceeded';

type ExpectedSlotSearchPlan = {
  cadence: ExpectedSlotSearchCadence;
  maxOccurrences: number;
  maxWindowMs: number;
};

type ExpectedSlotResolution =
  | {
      scheduledFor: Date;
      errorCode: null;
      error: null;
      windowMs: number;
      maxOccurrences: number;
      estimatedIntervalMs: number;
      cadence: ExpectedSlotSearchCadence;
    }
  | {
      scheduledFor: null;
      errorCode: ExpectedSlotResolutionErrorCode;
      error: string;
      windowMs: number | null;
      maxOccurrences: number | null;
      estimatedIntervalMs: number | null;
      cadence: ExpectedSlotSearchCadence | null;
    };

@Injectable()
export class SessionCleanupExecutionService implements OnModuleInit, OnModuleDestroy {
  static readonly JOB_KEY = 'system.session_cleanup';
  private static readonly LEASE_TTL_MS = 2 * 60 * 1000;
  private static readonly LEASE_RENEW_MS = 20 * 1000;
  private static readonly WORKER_POLL_MS = 5 * 1000;
  private static readonly MINUTE_MS = 60 * 1000;
  private static readonly HOUR_MS = 60 * SessionCleanupExecutionService.MINUTE_MS;
  private static readonly DAY_MS = 24 * SessionCleanupExecutionService.HOUR_MS;

  private readonly logger = new Logger(SessionCleanupExecutionService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private drainPromise: Promise<number> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly materializedExecutionService: MaterializedCronExecutionService,
    private readonly processor: SessionCleanupProcessorService,
  ) {}

  onModuleInit(): void {
    if (this.workerTimer) {
      return;
    }

    this.workerTimer = setInterval(() => {
      void this.requestDrain();
    }, SessionCleanupExecutionService.WORKER_POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  async materializeScheduledExecution(
    context?: CronJobExecutionContext,
  ): Promise<MaterializedCronExecutionRecord> {
    const scheduledFor = this.resolveScheduledFor(context);
    const ownerId = context?.instanceId || this.resolveOwnerId();

    const materialized = await this.materializedExecutionService.materializeExecution({
      jobKey: SessionCleanupExecutionService.JOB_KEY,
      scheduledFor,
      metadata: {
        triggerReason: context?.reason || 'scheduled',
        cronCycleId: context?.cycleId || null,
        cronInstanceId: context?.instanceId || null,
        materializedBy: ownerId,
      },
    });

    this.logger.log(
      `[SESSION_CLEANUP_SLOT_${materialized.created ? 'CREATED' : 'REUSED'}] scheduledFor=${scheduledFor.toISOString()} executionId=${materialized.execution.id}`,
    );

    void this.requestDrain();

    return materialized.execution;
  }

  async runWorkerOnce(): Promise<number> {
    const ownerId = this.resolveOwnerId();
    let processed = 0;

    while (true) {
      const execution = await this.materializedExecutionService.claimNextRunnableExecution({
        jobKey: SessionCleanupExecutionService.JOB_KEY,
        ownerId,
        ttlMs: SessionCleanupExecutionService.LEASE_TTL_MS,
      });

      if (!execution) {
        break;
      }

      processed += 1;
      await this.executeClaimedCleanup(execution, ownerId);
    }

    return processed;
  }

  async inspectExpectedExecution(params: {
    schedule: string;
    now: Date;
    staleAfterMs: number;
    stuckAfterMs: number;
    timeZone?: string | null;
  }): Promise<SessionCleanupWatchdogSnapshot> {
    const latestExecution = await this.materializedExecutionService.getLatestForJob(
      SessionCleanupExecutionService.JOB_KEY,
    );
    const scheduleTimeZone = this.resolveScheduleTimeZone(params.timeZone);
    const expectedSlotResolution = this.resolveExpectedScheduledFor(
      params.schedule,
      params.now,
      scheduleTimeZone,
    );
    const expectedScheduledFor = expectedSlotResolution.scheduledFor;

    if (!expectedScheduledFor) {
      return {
        expectedScheduledFor: null,
        execution: latestExecution,
        latestExecution,
        state: 'not_created',
        isOverdue: false,
        isStuck: false,
        reason: 'expected_slot_resolution_failed',
        scheduleTimeZone,
        slotResolutionErrorCode: expectedSlotResolution.errorCode,
        slotResolutionError: expectedSlotResolution.error,
        slotResolutionWindowMs: expectedSlotResolution.windowMs,
        slotResolutionMaxOccurrences: expectedSlotResolution.maxOccurrences,
        slotResolutionEstimatedIntervalMs: expectedSlotResolution.estimatedIntervalMs,
        slotResolutionCadence: expectedSlotResolution.cadence,
      };
    }

    const slotExecution = await this.materializedExecutionService.getBySlot(
      SessionCleanupExecutionService.JOB_KEY,
      expectedScheduledFor,
    );

    if (slotExecution) {
      return this.classifyExecution(
        slotExecution,
        latestExecution,
        params.now,
        params.staleAfterMs,
        params.stuckAfterMs,
        scheduleTimeZone,
      );
    }

    const isOverdue =
      params.now.getTime() > expectedScheduledFor.getTime() + params.staleAfterMs;

    return {
      expectedScheduledFor,
      execution: null,
      latestExecution,
      state: 'not_created',
      isOverdue,
      isStuck: false,
      reason: isOverdue ? 'slot_not_materialized' : 'slot_within_materialization_grace',
      scheduleTimeZone,
      slotResolutionErrorCode: null,
      slotResolutionError: null,
      slotResolutionWindowMs: expectedSlotResolution.windowMs,
      slotResolutionMaxOccurrences: expectedSlotResolution.maxOccurrences,
      slotResolutionEstimatedIntervalMs: expectedSlotResolution.estimatedIntervalMs,
      slotResolutionCadence: expectedSlotResolution.cadence,
    };
  }

  async inspectLatestExecution(params: {
    now: Date;
    stuckAfterMs: number;
    timeZone?: string | null;
  }): Promise<SessionCleanupWatchdogSnapshot> {
    const latestExecution = await this.materializedExecutionService.getLatestForJob(
      SessionCleanupExecutionService.JOB_KEY,
    );
    const scheduleTimeZone = this.resolveScheduleTimeZone(params.timeZone);

    if (!latestExecution) {
      return {
        expectedScheduledFor: null,
        execution: null,
        latestExecution: null,
        state: 'not_created',
        isOverdue: false,
        isStuck: false,
        reason: 'latest_execution_missing',
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    return this.classifyRuntimeExecution(
      latestExecution,
      latestExecution,
      params.now,
      params.stuckAfterMs,
      scheduleTimeZone,
    );
  }

  async inspectExecutionById(params: {
    executionId: string;
    now: Date;
    stuckAfterMs: number;
    timeZone?: string | null;
  }): Promise<SessionCleanupWatchdogSnapshot> {
    const [execution, latestExecution] = await Promise.all([
      this.materializedExecutionService.getById(params.executionId),
      this.materializedExecutionService.getLatestForJob(SessionCleanupExecutionService.JOB_KEY),
    ]);
    const scheduleTimeZone = this.resolveScheduleTimeZone(params.timeZone);

    if (!execution) {
      return {
        expectedScheduledFor: null,
        execution: null,
        latestExecution,
        state: 'not_created',
        isOverdue: false,
        isStuck: false,
        reason: 'execution_not_found',
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    return this.classifyRuntimeExecution(
      execution,
      latestExecution,
      params.now,
      params.stuckAfterMs,
      scheduleTimeZone,
    );
  }

  private classifyExecution(
    execution: MaterializedCronExecutionRecord,
    latestExecution: MaterializedCronExecutionRecord | null,
    now: Date,
    staleAfterMs: number,
    stuckAfterMs: number,
    scheduleTimeZone: string,
  ): SessionCleanupWatchdogSnapshot {
    if (execution.status === 'running') {
      const runtimeClassification = this.classifyRunningExecution(
        execution,
        now,
        stuckAfterMs,
      );

      return {
        expectedScheduledFor: execution.scheduledFor,
        execution,
        latestExecution,
        state: runtimeClassification.state,
        isOverdue: false,
        isStuck: runtimeClassification.isStuck,
        reason: runtimeClassification.reason,
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    if (execution.status === 'pending') {
      const isOverdue = now.getTime() > execution.scheduledFor.getTime() + staleAfterMs;
      return {
        expectedScheduledFor: execution.scheduledFor,
        execution,
        latestExecution,
        state: 'pending',
        isOverdue,
        isStuck: false,
        reason: isOverdue ? 'pending_past_expected_window' : 'pending',
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    return {
      expectedScheduledFor: execution.scheduledFor,
      execution,
      latestExecution,
      state: execution.status,
      isOverdue: false,
      isStuck: false,
      reason: execution.status,
      scheduleTimeZone,
      slotResolutionErrorCode: null,
      slotResolutionError: null,
      slotResolutionWindowMs: null,
      slotResolutionMaxOccurrences: null,
      slotResolutionEstimatedIntervalMs: null,
      slotResolutionCadence: null,
    };
  }

  private classifyRuntimeExecution(
    execution: MaterializedCronExecutionRecord,
    latestExecution: MaterializedCronExecutionRecord | null,
    now: Date,
    stuckAfterMs: number,
    scheduleTimeZone: string,
  ): SessionCleanupWatchdogSnapshot {
    if (execution.status === 'running') {
      const runtimeClassification = this.classifyRunningExecution(
        execution,
        now,
        stuckAfterMs,
      );

      return {
        expectedScheduledFor: execution.scheduledFor,
        execution,
        latestExecution,
        state: runtimeClassification.state,
        isOverdue: false,
        isStuck: runtimeClassification.isStuck,
        reason: runtimeClassification.reason,
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    if (execution.status === 'pending') {
      return {
        expectedScheduledFor: execution.scheduledFor,
        execution,
        latestExecution,
        state: 'pending',
        isOverdue: false,
        isStuck: false,
        reason: 'pending',
        scheduleTimeZone,
        slotResolutionErrorCode: null,
        slotResolutionError: null,
        slotResolutionWindowMs: null,
        slotResolutionMaxOccurrences: null,
        slotResolutionEstimatedIntervalMs: null,
        slotResolutionCadence: null,
      };
    }

    return {
      expectedScheduledFor: execution.scheduledFor,
      execution,
      latestExecution,
      state: execution.status,
      isOverdue: false,
      isStuck: false,
      reason: execution.status,
      scheduleTimeZone,
      slotResolutionErrorCode: null,
      slotResolutionError: null,
      slotResolutionWindowMs: null,
      slotResolutionMaxOccurrences: null,
      slotResolutionEstimatedIntervalMs: null,
      slotResolutionCadence: null,
    };
  }

  private classifyRunningExecution(
    execution: MaterializedCronExecutionRecord,
    now: Date,
    stuckAfterMs: number,
  ): RuntimeExecutionClassification {
    const reference = execution.heartbeatAt || execution.startedAt || execution.triggeredAt;
    const heartbeatStale = now.getTime() > reference.getTime() + stuckAfterMs;
    const lockExpired = execution.lockedUntil
      ? now.getTime() > execution.lockedUntil.getTime()
      : true;
    const isStuck =
      execution.finishedAt === null && heartbeatStale && lockExpired;

    return {
      state: isStuck ? 'stuck' : 'running',
      isStuck,
      reason: isStuck ? 'running_without_recent_heartbeat' : 'running',
      heartbeatStale,
      lockExpired,
    };
  }

  private resolveExpectedScheduledFor(
    schedule: string,
    now: Date,
    timeZone: string,
  ): ExpectedSlotResolution {
    let cronTime: CronTime;

    try {
      cronTime = new CronTime(schedule, timeZone);
    } catch (error) {
      return this.buildExpectedSlotResolutionError(
        'invalid_schedule',
        `Falha ao interpretar schedule ${schedule}: ${this.normalizeErrorMessage(error)}`,
      );
    }

    const intervalMs = this.estimateScheduleIntervalMs(cronTime, now, timeZone);
    if (!intervalMs || intervalMs <= 0) {
      return this.buildExpectedSlotResolutionError(
        'interval_estimation_failed',
        `Nao foi possivel estimar a periodicidade de ${schedule} para resolver o slot esperado.`,
      );
    }

    const searchPlan = this.resolveExpectedSlotSearchPlan(intervalMs);
    if (!searchPlan) {
      return this.buildExpectedSlotResolutionError(
        'unsupported_schedule_interval',
        `A periodicidade estimada de ${Math.round(intervalMs / SessionCleanupExecutionService.DAY_MS)} dia(s) excede a politica suportada pelo watchdog materialized.`,
        {
          estimatedIntervalMs: intervalMs,
        },
      );
    }

    const windowMs = Math.min(
      searchPlan.maxWindowMs,
      Math.max(intervalMs, intervalMs * searchPlan.maxOccurrences),
    );
    const anchor = new Date(now.getTime() - windowMs);

    try {
      let candidate = cronTime.getNextDateFrom(anchor, timeZone).toJSDate();

      if (candidate.getTime() > now.getTime()) {
        return this.buildExpectedSlotResolutionError(
          'slot_outside_resolution_window',
          `Nenhum slot de ${schedule} foi encontrado na janela proporcional de ${windowMs}ms.`,
          {
            estimatedIntervalMs: intervalMs,
            maxOccurrences: searchPlan.maxOccurrences,
            windowMs,
            cadence: searchPlan.cadence,
          },
        );
      }

      for (let occurrence = 1; occurrence <= searchPlan.maxOccurrences; occurrence += 1) {
        const nextCandidate = cronTime.getNextDateFrom(candidate, timeZone).toJSDate();
        if (nextCandidate.getTime() > now.getTime()) {
          return {
            scheduledFor: candidate,
            errorCode: null,
            error: null,
            windowMs,
            maxOccurrences: searchPlan.maxOccurrences,
            estimatedIntervalMs: intervalMs,
            cadence: searchPlan.cadence,
          };
        }

        candidate = nextCandidate;
      }

      return this.buildExpectedSlotResolutionError(
        'occurrence_limit_exceeded',
        `A resolucao do slot esperado de ${schedule} excedeu o limite de ${searchPlan.maxOccurrences} ocorrencias.`,
        {
          estimatedIntervalMs: intervalMs,
          maxOccurrences: searchPlan.maxOccurrences,
          windowMs,
          cadence: searchPlan.cadence,
        },
      );
    } catch (error) {
      return this.buildExpectedSlotResolutionError(
        'invalid_schedule',
        `Falha ao calcular o slot esperado de ${schedule}: ${this.normalizeErrorMessage(error)}`,
        {
          estimatedIntervalMs: intervalMs,
          maxOccurrences: searchPlan.maxOccurrences,
          windowMs,
          cadence: searchPlan.cadence,
        },
      );
    }
  }

  private estimateScheduleIntervalMs(
    cronTime: CronTime,
    referenceTime: Date,
    timeZone: string,
  ): number | null {
    try {
      const first = cronTime.getNextDateFrom(referenceTime, timeZone).toJSDate();
      const second = cronTime.getNextDateFrom(first, timeZone).toJSDate();
      const intervalMs = second.getTime() - first.getTime();

      if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        return null;
      }

      return intervalMs;
    } catch {
      return null;
    }
  }

  private resolveExpectedSlotSearchPlan(intervalMs: number): ExpectedSlotSearchPlan | null {
    if (intervalMs <= SessionCleanupExecutionService.HOUR_MS) {
      return {
        cadence: 'subdaily',
        maxOccurrences: 24,
        maxWindowMs: 3 * SessionCleanupExecutionService.DAY_MS,
      };
    }

    if (intervalMs <= SessionCleanupExecutionService.DAY_MS) {
      return {
        cadence: 'daily',
        maxOccurrences: 14,
        maxWindowMs: 21 * SessionCleanupExecutionService.DAY_MS,
      };
    }

    if (intervalMs <= 7 * SessionCleanupExecutionService.DAY_MS) {
      return {
        cadence: 'weekly',
        maxOccurrences: 12,
        maxWindowMs: 120 * SessionCleanupExecutionService.DAY_MS,
      };
    }

    if (intervalMs <= 62 * SessionCleanupExecutionService.DAY_MS) {
      return {
        cadence: 'monthly',
        maxOccurrences: 18,
        maxWindowMs: 550 * SessionCleanupExecutionService.DAY_MS,
      };
    }

    return null;
  }

  private buildExpectedSlotResolutionError(
    errorCode: ExpectedSlotResolutionErrorCode,
    error: string,
    metadata?: {
      estimatedIntervalMs?: number | null;
      maxOccurrences?: number | null;
      windowMs?: number | null;
      cadence?: ExpectedSlotSearchCadence | null;
    },
  ): ExpectedSlotResolution {
    return {
      scheduledFor: null,
      errorCode,
      error,
      windowMs: metadata?.windowMs ?? null,
      maxOccurrences: metadata?.maxOccurrences ?? null,
      estimatedIntervalMs: metadata?.estimatedIntervalMs ?? null,
      cadence: metadata?.cadence ?? null,
    };
  }

  private resolveScheduleTimeZone(timeZone?: string | null): string {
    const candidates = [
      typeof timeZone === 'string' ? timeZone.trim() : '',
      String(process.env.TZ || '').trim(),
      String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim(),
      'UTC',
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        new CronTime('* * * * *', candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    return 'UTC';
  }

  private async requestDrain(): Promise<number> {
    if (this.drainPromise) {
      return this.drainPromise;
    }

    this.drainPromise = this.runWorkerOnce()
      .catch((error) => {
        this.logger.error(
          `[SESSION_CLEANUP_WORKER_FAILED] ${String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        return 0;
      })
      .finally(() => {
        this.drainPromise = null;
      });

    return this.drainPromise;
  }

  private async executeClaimedCleanup(
    execution: MaterializedCronExecutionRecord,
    ownerId: string,
  ): Promise<void> {
    const leaseVersion = execution.leaseVersion;
    const abortController = new AbortController();
    let lostOwnershipError: Error | null = null;
    let finalizationStarted = false;

    const markLostOwnership = (
      stage: string,
      reason: MaterializedCronExecutionFailureReason | null,
      observedExecution: MaterializedCronExecutionRecord | null,
    ): Error => {
      if (lostOwnershipError) {
        return lostOwnershipError;
      }

      const error = new Error(
        `Execucao materializada ${execution.id} de ${SessionCleanupExecutionService.JOB_KEY} perdeu ownership em ${stage}. ownerId=${ownerId} leaseVersion=${leaseVersion.toString()} reason=${reason || 'unknown'} observedStatus=${observedExecution?.status || 'unknown'} observedOwner=${observedExecution?.ownerId || 'unknown'} observedLeaseVersion=${observedExecution?.leaseVersion?.toString() || 'unknown'}`,
      );
      error.name = 'MaterializedExecutionOwnershipLostError';
      lostOwnershipError = error;

      if (!abortController.signal.aborted) {
        abortController.abort();
      }

      this.logger.warn(
        `[SESSION_CLEANUP_OWNERSHIP_LOST] executionId=${execution.id} stage=${stage} ownerId=${ownerId} leaseVersion=${leaseVersion.toString()} reason=${reason || 'unknown'}`,
      );

      return error;
    };

    const throwIfAborted = (): void => {
      if (lostOwnershipError) {
        throw lostOwnershipError;
      }

      if (abortController.signal.aborted) {
        const error = new Error(
          `Execucao materializada ${execution.id} de ${SessionCleanupExecutionService.JOB_KEY} foi abortada por perda de ownership.`,
        );
        error.name = 'MaterializedExecutionOwnershipLostError';
        throw error;
      }
    };

    const assertOwnership = async (stage: string): Promise<void> => {
      throwIfAborted();

      const ownership = await this.materializedExecutionService.assertExecutionOwnership({
        executionId: execution.id,
        ownerId,
        leaseVersion,
      });

      if (!ownership.owned) {
        throw markLostOwnership(stage, ownership.reason, ownership.execution);
      }
    };

    const executionContext: CronJobExecutionContext = {
      reason: this.resolveExecutionReason(execution),
      cycleId: execution.scheduledFor.getTime().toString(),
      instanceId: ownerId,
      signal: abortController.signal,
      lease: {
        jobKey: execution.jobKey,
        ownerId,
        cycleId: execution.id,
        leaseVersion,
      },
      assertLeaseOwnership: assertOwnership,
      throwIfAborted,
    };

    const renewInterval = setInterval(async () => {
      if (finalizationStarted) {
        return;
      }

      const renewed = await this.materializedExecutionService.renewExecution({
        executionId: execution.id,
        ownerId,
        leaseVersion,
        ttlMs: SessionCleanupExecutionService.LEASE_TTL_MS,
      });

      if (!renewed.persisted && !lostOwnershipError) {
        markLostOwnership('renew', renewed.reason, renewed.execution);
      }
    }, SessionCleanupExecutionService.LEASE_RENEW_MS);

    try {
      this.logger.log(
        `[SESSION_CLEANUP_EXECUTION_STARTED] executionId=${execution.id} scheduledFor=${execution.scheduledFor.toISOString()} ownerId=${ownerId} leaseVersion=${leaseVersion.toString()} attempt=${execution.attempt}`,
      );

      await assertOwnership('before_cleanup');
      await this.processor.cleanupExpiredSessions(executionContext);
      throwIfAborted();

      finalizationStarted = true;
      const finalized = await this.materializedExecutionService.finalizeExecution({
        executionId: execution.id,
        ownerId,
        leaseVersion,
        status: 'success',
        reason: 'completed',
      });

      if (!finalized.persisted) {
        await this.handleTerminalPersistenceGap({
          execution,
          ownerId,
          leaseVersion,
          intendedStatus: 'success',
          failureReason: finalized.reason,
          observedExecution: finalized.execution,
        });
        return;
      }

      this.logger.log(
        `[SESSION_CLEANUP_EXECUTION_FINISHED] executionId=${execution.id} scheduledFor=${execution.scheduledFor.toISOString()} status=success`,
      );
    } catch (error) {
      finalizationStarted = true;
      const finalError = lostOwnershipError || error;
      const intendedStatus: Exclude<MaterializedCronExecutionStatus, 'pending' | 'running'> =
        this.isOwnershipLostError(finalError) ? 'aborted' : 'failed';

      const finalized = await this.materializedExecutionService.finalizeExecution({
        executionId: execution.id,
        ownerId,
        leaseVersion,
        status: intendedStatus,
        reason: intendedStatus === 'aborted' ? 'ownership_lost' : 'failed',
        error: finalError,
      });

      if (!finalized.persisted) {
        await this.handleTerminalPersistenceGap({
          execution,
          ownerId,
          leaseVersion,
          intendedStatus,
          failureReason: finalized.reason,
          observedExecution: finalized.execution,
          error: finalError,
        });
      }

      if (this.isOwnershipLostError(finalError)) {
        this.logger.warn(
          `[SESSION_CLEANUP_EXECUTION_SUPERSEDED] executionId=${execution.id} scheduledFor=${execution.scheduledFor.toISOString()} ownerId=${ownerId}`,
        );
        return;
      }

      this.logger.error(
        `[SESSION_CLEANUP_EXECUTION_FAILED] executionId=${execution.id} scheduledFor=${execution.scheduledFor.toISOString()}`,
        finalError as Error,
      );
    } finally {
      clearInterval(renewInterval);
    }
  }

  private async handleTerminalPersistenceGap(params: {
    execution: MaterializedCronExecutionRecord;
    ownerId: string;
    leaseVersion: bigint;
    intendedStatus: Exclude<MaterializedCronExecutionStatus, 'pending' | 'running'>;
    failureReason: MaterializedCronExecutionFailureReason | null;
    observedExecution: MaterializedCronExecutionRecord | null;
    error?: unknown;
  }): Promise<void> {
    if (params.failureReason === 'database_error' && params.intendedStatus === 'success') {
      const failedFallback = await this.materializedExecutionService.finalizeExecution({
        executionId: params.execution.id,
        ownerId: params.ownerId,
        leaseVersion: params.leaseVersion,
        status: 'failed',
        reason: 'terminal_persistence_error',
        error: params.error || 'SUCCESS_FINALIZATION_PERSISTENCE_ERROR',
      });

      if (failedFallback.persisted) {
        this.logger.error(
          `[SESSION_CLEANUP_TERMINAL_FALLBACK_TO_FAILED] executionId=${params.execution.id} scheduledFor=${params.execution.scheduledFor.toISOString()}`,
        );
        return;
      }

      await this.persistExecutionAudit({
        action: 'SESSION_CLEANUP_TERMINAL_FALLBACK',
        severity: 'error',
        message: `Execucao ${params.execution.id} do Session Cleanup caiu em fallback terminal ${this.resolveFallbackAuditStatus(params.intendedStatus, failedFallback.reason)}.`,
        details: this.normalizeErrorMessage(params.error || 'SUCCESS_FINALIZATION_PERSISTENCE_ERROR'),
        metadata: {
          executionId: params.execution.id,
          scheduledFor: params.execution.scheduledFor.toISOString(),
          intendedStatus: params.intendedStatus,
          persistedStatus: this.resolveFallbackAuditStatus(params.intendedStatus, failedFallback.reason),
          ownerId: params.ownerId,
          leaseVersion: params.leaseVersion.toString(),
          failureReason: failedFallback.reason || params.failureReason,
          observedExecutionStatus: failedFallback.execution?.status || null,
          observedOwnerId: failedFallback.execution?.ownerId || null,
          observedLeaseVersion: failedFallback.execution?.leaseVersion?.toString() || null,
        },
      });
      return;
    }

    await this.persistExecutionAudit({
      action: 'SESSION_CLEANUP_TERMINAL_FALLBACK',
      severity: params.intendedStatus === 'failed' ? 'error' : 'warning',
      message: `Execucao ${params.execution.id} do Session Cleanup perdeu o terminal ${params.intendedStatus}.`,
      details: this.normalizeErrorMessage(params.error || params.failureReason || 'TERMINAL_REJECTED'),
      metadata: {
        executionId: params.execution.id,
        scheduledFor: params.execution.scheduledFor.toISOString(),
        intendedStatus: params.intendedStatus,
        persistedStatus: this.resolveFallbackAuditStatus(params.intendedStatus, params.failureReason),
        ownerId: params.ownerId,
        leaseVersion: params.leaseVersion.toString(),
        failureReason: params.failureReason,
        observedExecutionStatus: params.observedExecution?.status || null,
        observedOwnerId: params.observedExecution?.ownerId || null,
        observedLeaseVersion: params.observedExecution?.leaseVersion?.toString() || null,
      },
    });
  }

  private resolveFallbackAuditStatus(
    intendedStatus: Exclude<MaterializedCronExecutionStatus, 'pending' | 'running'>,
    failureReason: MaterializedCronExecutionFailureReason | null,
  ): Exclude<MaterializedCronExecutionStatus, 'pending' | 'running'> {
    if (
      failureReason === 'ownership_mismatch' ||
      failureReason === 'fencing_mismatch' ||
      failureReason === 'lease_expired' ||
      failureReason === 'terminal_state'
    ) {
      return 'superseded';
    }

    if (intendedStatus === 'success') {
      return 'failed';
    }

    return intendedStatus;
  }

  private async persistExecutionAudit(params: {
    action: string;
    severity: string;
    message: string;
    details: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          severity: params.severity,
          message: params.message,
          details: params.details,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        `[SESSION_CLEANUP_AUDIT_FALLBACK_FAILED] ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private resolveExecutionReason(execution: MaterializedCronExecutionRecord): 'scheduled' | 'manual' {
    const metadata = execution.metadata as Record<string, unknown> | null;
    return metadata?.triggerReason === 'manual' ? 'manual' : 'scheduled';
  }

  private resolveScheduledFor(context?: CronJobExecutionContext): Date {
    if (context?.reason === 'scheduled') {
      const cycleIdNumber = Number.parseInt(context.cycleId, 10);
      if (Number.isFinite(cycleIdNumber)) {
        return new Date(cycleIdNumber);
      }
    }

    return new Date();
  }

  private resolveOwnerId(): string {
    const runtimeParts = [
      String(process.env.NODE_APP_INSTANCE || '').trim(),
      String(process.env.HOSTNAME || process.env.COMPUTERNAME || '').trim(),
      `pid-${process.pid}`,
    ].filter((part) => part.length > 0);

    return runtimeParts.length > 0 ? runtimeParts.join(':') : 'single-instance';
  }

  private isOwnershipLostError(error: unknown): boolean {
    return error instanceof Error && error.name === 'MaterializedExecutionOwnershipLostError';
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
