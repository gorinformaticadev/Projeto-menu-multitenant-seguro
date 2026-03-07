import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CronJobHeartbeatStatus = 'idle' | 'running' | 'success' | 'failed';

export interface CronJobHeartbeatRecord {
  jobKey: string;
  lastStartedAt: Date | null;
  lastSucceededAt: Date | null;
  lastFailedAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: CronJobHeartbeatStatus;
  lastError: string | null;
  nextExpectedRunAt: Date | null;
  consecutiveFailureCount: number;
  updatedAt: Date;
}

type HeartbeatRow = {
  jobKey: string;
  lastStartedAt: Date | null;
  lastSucceededAt: Date | null;
  lastFailedAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: string | null;
  lastError: string | null;
  nextExpectedRunAt: Date | null;
  consecutiveFailureCount: number | null;
  updatedAt: Date;
};

@Injectable()
export class CronJobHeartbeatService {
  private readonly logger = new Logger(CronJobHeartbeatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(jobKeys?: string[]): Promise<Map<string, CronJobHeartbeatRecord>> {
    try {
      const rows = await this.queryRows(jobKeys);
      return new Map(rows.map((row) => [row.jobKey, this.mapRow(row)]));
    } catch (error) {
      this.logger.warn(`Falha ao listar heartbeat dos jobs de cron: ${String(error)}`);
      return new Map();
    }
  }

  async get(jobKey: string): Promise<CronJobHeartbeatRecord | null> {
    const rows = await this.queryRows([jobKey]);
    if (rows.length === 0) {
      return null;
    }
    return this.mapRow(rows[0]);
  }

  async markScheduled(jobKey: string, nextExpectedRunAt: Date | null): Promise<void> {
    const current = await this.get(jobKey);
    await this.persist({
      jobKey,
      lastStartedAt: current?.lastStartedAt || null,
      lastSucceededAt: current?.lastSucceededAt || null,
      lastFailedAt: current?.lastFailedAt || null,
      lastDurationMs: current?.lastDurationMs || null,
      lastStatus:
        current?.lastStatus === 'running'
          ? 'running'
          : current?.lastStatus || 'idle',
      lastError: current?.lastError || null,
      nextExpectedRunAt,
      consecutiveFailureCount: current?.consecutiveFailureCount || 0,
      updatedAt: new Date(),
    });
  }

  async markStarted(jobKey: string, startedAt: Date, nextExpectedRunAt: Date | null): Promise<void> {
    const current = await this.get(jobKey);
    await this.persist({
      jobKey,
      lastStartedAt: startedAt,
      lastSucceededAt: current?.lastSucceededAt || null,
      lastFailedAt: current?.lastFailedAt || null,
      lastDurationMs: current?.lastDurationMs || null,
      lastStatus: 'running',
      lastError: null,
      nextExpectedRunAt,
      consecutiveFailureCount: current?.consecutiveFailureCount || 0,
      updatedAt: new Date(),
    });
  }

  async markSuccess(
    jobKey: string,
    startedAt: Date,
    finishedAt: Date,
    nextExpectedRunAt: Date | null,
  ): Promise<void> {
    await this.persist({
      jobKey,
      lastStartedAt: startedAt,
      lastSucceededAt: finishedAt,
      lastFailedAt: (await this.get(jobKey))?.lastFailedAt || null,
      lastDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      lastStatus: 'success',
      lastError: null,
      nextExpectedRunAt,
      consecutiveFailureCount: 0,
      updatedAt: finishedAt,
    });
  }

  async markFailure(
    jobKey: string,
    startedAt: Date,
    finishedAt: Date,
    error: unknown,
    nextExpectedRunAt: Date | null,
  ): Promise<void> {
    const current = await this.get(jobKey);
    await this.persist({
      jobKey,
      lastStartedAt: startedAt,
      lastSucceededAt: current?.lastSucceededAt || null,
      lastFailedAt: finishedAt,
      lastDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      lastStatus: 'failed',
      lastError: this.normalizeError(error),
      nextExpectedRunAt,
      consecutiveFailureCount: (current?.consecutiveFailureCount || 0) + 1,
      updatedAt: finishedAt,
    });
  }

  private async queryRows(jobKeys?: string[]): Promise<HeartbeatRow[]> {
    if (Array.isArray(jobKeys) && jobKeys.length === 0) {
      return [];
    }

    if (!jobKeys || jobKeys.length === 0) {
      return this.prisma.$queryRaw<HeartbeatRow[]>`
        SELECT
          "jobKey",
          "lastStartedAt",
          "lastSucceededAt",
          "lastFailedAt",
          "lastDurationMs",
          "lastStatus",
          "lastError",
          "nextExpectedRunAt",
          "consecutiveFailureCount",
          "updatedAt"
        FROM "cron_job_heartbeats"
      `;
    }

    return this.prisma.$queryRaw<HeartbeatRow[]>`
      SELECT
        "jobKey",
        "lastStartedAt",
        "lastSucceededAt",
        "lastFailedAt",
        "lastDurationMs",
        "lastStatus",
        "lastError",
        "nextExpectedRunAt",
        "consecutiveFailureCount",
        "updatedAt"
      FROM "cron_job_heartbeats"
      WHERE "jobKey" IN (${Prisma.join(jobKeys)})
    `;
  }

  private async persist(record: CronJobHeartbeatRecord): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "cron_job_heartbeats" (
        "jobKey",
        "lastStartedAt",
        "lastSucceededAt",
        "lastFailedAt",
        "lastDurationMs",
        "lastStatus",
        "lastError",
        "nextExpectedRunAt",
        "consecutiveFailureCount",
        "updatedAt"
      ) VALUES (
        ${record.jobKey},
        ${record.lastStartedAt},
        ${record.lastSucceededAt},
        ${record.lastFailedAt},
        ${record.lastDurationMs},
        ${record.lastStatus},
        ${record.lastError},
        ${record.nextExpectedRunAt},
        ${record.consecutiveFailureCount},
        ${record.updatedAt}
      )
      ON CONFLICT ("jobKey") DO UPDATE SET
        "lastStartedAt" = EXCLUDED."lastStartedAt",
        "lastSucceededAt" = EXCLUDED."lastSucceededAt",
        "lastFailedAt" = EXCLUDED."lastFailedAt",
        "lastDurationMs" = EXCLUDED."lastDurationMs",
        "lastStatus" = EXCLUDED."lastStatus",
        "lastError" = EXCLUDED."lastError",
        "nextExpectedRunAt" = EXCLUDED."nextExpectedRunAt",
        "consecutiveFailureCount" = EXCLUDED."consecutiveFailureCount",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }

  private mapRow(row: HeartbeatRow): CronJobHeartbeatRecord {
    return {
      jobKey: row.jobKey,
      lastStartedAt: row.lastStartedAt || null,
      lastSucceededAt: row.lastSucceededAt || null,
      lastFailedAt: row.lastFailedAt || null,
      lastDurationMs: row.lastDurationMs ?? null,
      lastStatus: this.normalizeStatus(row.lastStatus),
      lastError: row.lastError || null,
      nextExpectedRunAt: row.nextExpectedRunAt || null,
      consecutiveFailureCount: Math.max(0, row.consecutiveFailureCount || 0),
      updatedAt: row.updatedAt,
    };
  }

  private normalizeStatus(value: string | null | undefined): CronJobHeartbeatStatus {
    if (value === 'running' || value === 'success' || value === 'failed') {
      return value;
    }
    return 'idle';
  }

  private normalizeError(error: unknown): string | null {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim().slice(0, 500);
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim().slice(0, 500);
    }

    return 'Falha desconhecida';
  }
}
