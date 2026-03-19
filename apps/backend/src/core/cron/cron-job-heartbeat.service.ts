import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CronJobHeartbeatStatus = 'idle' | 'running' | 'success' | 'failed';

export interface CronJobHeartbeatRecord {
  jobKey: string;
  lastStartedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastSucceededAt: Date | null;
  lastFailedAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: CronJobHeartbeatStatus;
  lastError: string | null;
  nextExpectedRunAt: Date | null;
  consecutiveFailureCount: number;
  updatedAt: Date;
  cycleId?: string | null;
  instanceId?: string | null;
}

type HeartbeatRow = {
  jobKey: string;
  lastStartedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastSucceededAt: Date | null;
  lastFailedAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: string | null;
  lastError: string | null;
  nextExpectedRunAt: Date | null;
  consecutiveFailureCount: number | null;
  updatedAt: Date;
  cycleId: string | null;
  instanceId: string | null;
};

type OptionalHeartbeatColumns = {
  lastHeartbeatAt: boolean;
  cycleId: boolean;
  instanceId: boolean;
};

type InformationSchemaColumnRow = {
  column_name: string;
};

const OPTIONAL_COLUMN_QUERY = `
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'cron_job_heartbeats'
    AND column_name IN ('lastHeartbeatAt', 'cycleId', 'instanceId')
`;

@Injectable()
export class CronJobHeartbeatService {
  private readonly logger = new Logger(CronJobHeartbeatService.name);
  private optionalColumnsCache: OptionalHeartbeatColumns | null = null;
  private optionalColumnsPromise: Promise<OptionalHeartbeatColumns> | null = null;
  private legacySchemaWarned = false;

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
      lastHeartbeatAt: current?.lastHeartbeatAt || null,
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
      cycleId: current?.cycleId,
      instanceId: current?.instanceId,
    });
  }

  async markStarted(
    jobKey: string,
    startedAt: Date,
    nextExpectedRunAt: Date | null,
    cycleId: string,
    instanceId: string,
    stuckAfterMs = 15 * 60 * 1000,
  ): Promise<boolean> {
    const optionalColumns = await this.getOptionalColumns();
    const fallbackDate = new Date(Date.now() - stuckAfterMs);
    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const setClauses = [
      `"lastStartedAt" = ${bind(startedAt)}`,
      optionalColumns.lastHeartbeatAt ? `"lastHeartbeatAt" = NOW()` : null,
      `"lastStatus" = 'running'`,
      `"nextExpectedRunAt" = ${bind(nextExpectedRunAt)}`,
      optionalColumns.cycleId ? `"cycleId" = ${bind(cycleId)}` : null,
      optionalColumns.instanceId ? `"instanceId" = ${bind(instanceId)}` : null,
      `"lastError" = NULL`,
      `"updatedAt" = NOW()`,
    ].filter((value): value is string => Boolean(value));

    const staleRunningCondition = optionalColumns.lastHeartbeatAt
      ? `"lastHeartbeatAt" < ${bind(fallbackDate)}`
      : `"updatedAt" < ${bind(fallbackDate)}`;
    const jobKeyParam = bind(jobKey);

    try {
      const result = await this.prisma.$executeRawUnsafe(
        `
          UPDATE "cron_job_heartbeats"
          SET ${setClauses.join(', ')}
          WHERE "jobKey" = ${jobKeyParam}
            AND ("lastStatus" != 'running' OR ${staleRunningCondition})
        `,
        ...params,
      );

      if (result > 0) {
        return true;
      }

      const current = await this.get(jobKey);
      if (!current) {
        return this.insertStartedRecord(
          optionalColumns,
          jobKey,
          startedAt,
          nextExpectedRunAt,
          cycleId,
          instanceId,
        );
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Erro ao marcar inicio de ciclo (markStarted) para ${jobKey}: ${String(error)}`,
      );
      return false;
    }
  }

  async updateHeartbeat(jobKey: string): Promise<void> {
    const optionalColumns = await this.getOptionalColumns();
    const setClause = optionalColumns.lastHeartbeatAt
      ? `"lastHeartbeatAt" = NOW(), "updatedAt" = NOW()`
      : `"updatedAt" = NOW()`;

    try {
      await this.prisma.$executeRawUnsafe(
        `
          UPDATE "cron_job_heartbeats"
          SET ${setClause}
          WHERE "jobKey" = $1 AND "lastStatus" = 'running'
        `,
        jobKey,
      );
    } catch (error) {
      this.logger.warn(`Falha ao atualizar heartbeat para ${jobKey}: ${String(error)}`);
    }
  }

  async markSuccess(
    jobKey: string,
    startedAt: Date,
    finishedAt: Date,
    nextExpectedRunAt: Date | null,
  ): Promise<void> {
    const current = await this.get(jobKey);
    await this.persist({
      jobKey,
      lastStartedAt: startedAt,
      lastHeartbeatAt: finishedAt,
      lastSucceededAt: finishedAt,
      lastFailedAt: current?.lastFailedAt || null,
      lastDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      lastStatus: 'success',
      lastError: null,
      nextExpectedRunAt,
      consecutiveFailureCount: 0,
      updatedAt: finishedAt,
      cycleId: current?.cycleId,
      instanceId: current?.instanceId,
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
      lastHeartbeatAt: finishedAt,
      lastSucceededAt: current?.lastSucceededAt || null,
      lastFailedAt: finishedAt,
      lastDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      lastStatus: 'failed',
      lastError: this.normalizeError(error),
      nextExpectedRunAt,
      consecutiveFailureCount: (current?.consecutiveFailureCount || 0) + 1,
      updatedAt: finishedAt,
      cycleId: current?.cycleId,
      instanceId: current?.instanceId,
    });
  }

  async reconcileOrphans(defaultUnstuckMs = 15 * 60 * 1000): Promise<number> {
    const optionalColumns = await this.getOptionalColumns();
    const thresholdDate = new Date(Date.now() - defaultUnstuckMs);
    const staleCondition = optionalColumns.lastHeartbeatAt
      ? `("lastHeartbeatAt" < $1 OR ("lastHeartbeatAt" IS NULL AND "updatedAt" < $1))`
      : `"updatedAt" < $1`;

    try {
      const result = await this.prisma.$executeRawUnsafe(
        `
          UPDATE "cron_job_heartbeats"
          SET
            "lastStatus" = 'failed',
            "lastError" = 'STUCK_ORPHAN_RECOVERED',
            "updatedAt" = NOW()
          WHERE "lastStatus" = 'running'
            AND (${staleCondition})
        `,
        thresholdDate,
      );

      if (result > 0) {
        this.logger.log(`[ORPHAN_RECONCILER] Forcados ${result} jobs travados para FAILED.`);
      }

      return result;
    } catch (error) {
      this.logger.error(`[ORPHAN_RECONCILER] Falha ao reconciliar orfaos: ${String(error)}`);
      return 0;
    }
  }

  private async queryRows(jobKeys?: string[]): Promise<HeartbeatRow[]> {
    if (Array.isArray(jobKeys) && jobKeys.length === 0) {
      return [];
    }

    const optionalColumns = await this.getOptionalColumns();
    const selectColumns = [
      `"jobKey"`,
      `"lastStartedAt"`,
      optionalColumns.lastHeartbeatAt
        ? `"lastHeartbeatAt" AS "lastHeartbeatAt"`
        : `NULL::TIMESTAMP AS "lastHeartbeatAt"`,
      `"lastSucceededAt"`,
      `"lastFailedAt"`,
      `"lastDurationMs"`,
      `"lastStatus"`,
      `"lastError"`,
      `"nextExpectedRunAt"`,
      `"consecutiveFailureCount"`,
      `"updatedAt"`,
      optionalColumns.cycleId ? `"cycleId" AS "cycleId"` : `NULL::TEXT AS "cycleId"`,
      optionalColumns.instanceId
        ? `"instanceId" AS "instanceId"`
        : `NULL::TEXT AS "instanceId"`,
    ];

    const params: unknown[] = [];
    let whereClause = '';

    if (jobKeys && jobKeys.length > 0) {
      const placeholders = jobKeys.map((jobKey) => {
        params.push(jobKey);
        return `$${params.length}`;
      });
      whereClause = ` WHERE "jobKey" IN (${placeholders.join(', ')})`;
    }

    return this.prisma.$queryRawUnsafe<HeartbeatRow[]>(
      `
        SELECT
          ${selectColumns.join(',\n          ')}
        FROM "cron_job_heartbeats"${whereClause}
      `,
      ...params,
    );
  }

  private async persist(record: CronJobHeartbeatRecord): Promise<void> {
    const optionalColumns = await this.getOptionalColumns();
    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const columnEntries: Array<{ column: string; placeholder: string }> = [
      { column: `"jobKey"`, placeholder: bind(record.jobKey) },
      { column: `"lastStartedAt"`, placeholder: bind(record.lastStartedAt) },
      ...(optionalColumns.lastHeartbeatAt
        ? [{ column: `"lastHeartbeatAt"`, placeholder: bind(record.lastHeartbeatAt) }]
        : []),
      { column: `"lastSucceededAt"`, placeholder: bind(record.lastSucceededAt) },
      { column: `"lastFailedAt"`, placeholder: bind(record.lastFailedAt) },
      { column: `"lastDurationMs"`, placeholder: bind(record.lastDurationMs) },
      { column: `"lastStatus"`, placeholder: bind(record.lastStatus) },
      { column: `"lastError"`, placeholder: bind(record.lastError) },
      { column: `"nextExpectedRunAt"`, placeholder: bind(record.nextExpectedRunAt) },
      {
        column: `"consecutiveFailureCount"`,
        placeholder: bind(record.consecutiveFailureCount),
      },
      { column: `"updatedAt"`, placeholder: bind(record.updatedAt) },
      ...(optionalColumns.cycleId
        ? [{ column: `"cycleId"`, placeholder: bind(record.cycleId || null) }]
        : []),
      ...(optionalColumns.instanceId
        ? [{ column: `"instanceId"`, placeholder: bind(record.instanceId || null) }]
        : []),
    ];

    const updateAssignments = columnEntries
      .filter((entry) => entry.column !== `"jobKey"`)
      .map((entry) => `${entry.column} = EXCLUDED.${entry.column}`);

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "cron_job_heartbeats" (
          ${columnEntries.map((entry) => entry.column).join(', ')}
        ) VALUES (
          ${columnEntries.map((entry) => entry.placeholder).join(', ')}
        )
        ON CONFLICT ("jobKey") DO UPDATE SET
          ${updateAssignments.join(', ')}
      `,
      ...params,
    );
  }

  private async insertStartedRecord(
    optionalColumns: OptionalHeartbeatColumns,
    jobKey: string,
    startedAt: Date,
    nextExpectedRunAt: Date | null,
    cycleId: string,
    instanceId: string,
  ): Promise<boolean> {
    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const columnEntries: Array<{ column: string; placeholder: string }> = [
      { column: `"jobKey"`, placeholder: bind(jobKey) },
      { column: `"lastStartedAt"`, placeholder: bind(startedAt) },
      ...(optionalColumns.lastHeartbeatAt
        ? [{ column: `"lastHeartbeatAt"`, placeholder: 'NOW()' }]
        : []),
      { column: `"lastStatus"`, placeholder: `'running'` },
      { column: `"nextExpectedRunAt"`, placeholder: bind(nextExpectedRunAt) },
      ...(optionalColumns.cycleId
        ? [{ column: `"cycleId"`, placeholder: bind(cycleId) }]
        : []),
      ...(optionalColumns.instanceId
        ? [{ column: `"instanceId"`, placeholder: bind(instanceId) }]
        : []),
      { column: `"updatedAt"`, placeholder: 'NOW()' },
    ];

    try {
      const inserted = await this.prisma.$executeRawUnsafe(
        `
          INSERT INTO "cron_job_heartbeats" (
            ${columnEntries.map((entry) => entry.column).join(', ')}
          ) VALUES (
            ${columnEntries.map((entry) => entry.placeholder).join(', ')}
          )
          ON CONFLICT ("jobKey") DO NOTHING
        `,
        ...params,
      );

      return inserted > 0;
    } catch {
      return false;
    }
  }

  private async getOptionalColumns(): Promise<OptionalHeartbeatColumns> {
    if (this.optionalColumnsCache) {
      return this.optionalColumnsCache;
    }

    if (this.optionalColumnsPromise) {
      return this.optionalColumnsPromise;
    }

    this.optionalColumnsPromise = this.loadOptionalColumns();

    try {
      const resolved = await this.optionalColumnsPromise;
      this.optionalColumnsCache = resolved;
      return resolved;
    } finally {
      this.optionalColumnsPromise = null;
    }
  }

  private async loadOptionalColumns(): Promise<OptionalHeartbeatColumns> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<InformationSchemaColumnRow[]>(
        OPTIONAL_COLUMN_QUERY,
      );
      const presentColumns = new Set(rows.map((row) => row.column_name));
      const optionalColumns: OptionalHeartbeatColumns = {
        lastHeartbeatAt: presentColumns.has('lastHeartbeatAt'),
        cycleId: presentColumns.has('cycleId'),
        instanceId: presentColumns.has('instanceId'),
      };

      this.warnIfLegacySchema(optionalColumns);
      return optionalColumns;
    } catch (error) {
      this.logger.warn(
        `Falha ao inspecionar schema de cron_job_heartbeats. Assumindo schema mais novo: ${String(error)}`,
      );
      return {
        lastHeartbeatAt: true,
        cycleId: true,
        instanceId: true,
      };
    }
  }

  private warnIfLegacySchema(optionalColumns: OptionalHeartbeatColumns): void {
    if (this.legacySchemaWarned) {
      return;
    }

    const missingColumns = Object.entries(optionalColumns)
      .filter(([, available]) => !available)
      .map(([column]) => column);

    if (missingColumns.length === 0) {
      return;
    }

    this.legacySchemaWarned = true;
    this.logger.warn(
      `Schema legado detectado em cron_job_heartbeats. Colunas ausentes: ${missingColumns.join(
        ', ',
      )}. O backend entrou em modo de compatibilidade. Aplique a migration 20260318181500_add_last_heartbeat para restaurar todos os metadados de heartbeat.`,
    );
  }

  private mapRow(row: HeartbeatRow): CronJobHeartbeatRecord {
    return {
      jobKey: row.jobKey,
      lastStartedAt: row.lastStartedAt || null,
      lastHeartbeatAt: row.lastHeartbeatAt || null,
      lastSucceededAt: row.lastSucceededAt || null,
      lastFailedAt: row.lastFailedAt || null,
      lastDurationMs: row.lastDurationMs ?? null,
      lastStatus: this.normalizeStatus(row.lastStatus),
      lastError: row.lastError || null,
      nextExpectedRunAt: row.nextExpectedRunAt || null,
      consecutiveFailureCount: Math.max(0, row.consecutiveFailureCount || 0),
      updatedAt: row.updatedAt,
      cycleId: row.cycleId || null,
      instanceId: row.instanceId || null,
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
