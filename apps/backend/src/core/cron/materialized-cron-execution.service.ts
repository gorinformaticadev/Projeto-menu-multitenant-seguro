import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type MaterializedCronExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'superseded'
  | 'aborted';

export type MaterializedCronExecutionFailureReason =
  | 'not_found'
  | 'ownership_mismatch'
  | 'fencing_mismatch'
  | 'terminal_state'
  | 'lease_expired'
  | 'not_runnable'
  | 'database_error';

export interface MaterializedCronExecutionRecord {
  id: string;
  jobKey: string;
  scheduledFor: Date;
  triggeredAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: MaterializedCronExecutionStatus;
  ownerId: string | null;
  attempt: number;
  leaseVersion: bigint;
  lockedUntil: Date | null;
  heartbeatAt: Date | null;
  reason: string | null;
  error: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterializeCronExecutionInput {
  jobKey: string;
  scheduledFor: Date;
  triggeredAt?: Date;
  metadata?: Prisma.JsonValue;
}

export interface MaterializeCronExecutionResult {
  created: boolean;
  execution: MaterializedCronExecutionRecord;
}

export interface ClaimMaterializedCronExecutionInput {
  jobKey: string;
  ownerId: string;
  ttlMs: number;
}

export interface RenewMaterializedCronExecutionInput {
  executionId: string;
  ownerId: string;
  leaseVersion: bigint;
  ttlMs: number;
}

export interface FinalizeMaterializedCronExecutionInput {
  executionId: string;
  ownerId: string;
  leaseVersion: bigint;
  status: Exclude<MaterializedCronExecutionStatus, 'pending' | 'running'>;
  finishedAt?: Date;
  reason?: string | null;
  error?: unknown;
}

export interface AssertMaterializedCronExecutionOwnershipInput {
  executionId: string;
  ownerId: string;
  leaseVersion: bigint;
}

export interface MaterializedCronExecutionWriteResult {
  persisted: boolean;
  execution: MaterializedCronExecutionRecord | null;
  reason: MaterializedCronExecutionFailureReason | null;
}

export interface MaterializedCronExecutionOwnershipResult {
  owned: boolean;
  execution: MaterializedCronExecutionRecord | null;
  reason: MaterializedCronExecutionFailureReason | null;
}

type MaterializedCronExecutionRow = {
  id: string;
  jobKey: string;
  scheduledFor: Date;
  triggeredAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: string;
  ownerId: string | null;
  attempt: number | bigint;
  leaseVersion: bigint | number | string;
  lockedUntil: Date | null;
  heartbeatAt: Date | null;
  reason: string | null;
  error: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MaterializedCronExecutionService {
  private readonly logger = new Logger(MaterializedCronExecutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getById(executionId: string): Promise<MaterializedCronExecutionRecord | null> {
    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        SELECT
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
        FROM "cron_materialized_executions"
        WHERE "id" = ${executionId}
      `);

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      this.logger.warn(`Falha ao consultar execucao materializada ${executionId}: ${String(error)}`);
      return null;
    }
  }

  async getBySlot(jobKey: string, scheduledFor: Date): Promise<MaterializedCronExecutionRecord | null> {
    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        SELECT
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
        FROM "cron_materialized_executions"
        WHERE "jobKey" = ${jobKey}
          AND "scheduledFor" = ${scheduledFor}
      `);

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      this.logger.warn(
        `Falha ao consultar execucao materializada de ${jobKey} para ${scheduledFor.toISOString()}: ${String(error)}`,
      );
      return null;
    }
  }

  async getLatestForJob(jobKey: string): Promise<MaterializedCronExecutionRecord | null> {
    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        SELECT
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
        FROM "cron_materialized_executions"
        WHERE "jobKey" = ${jobKey}
        ORDER BY "scheduledFor" DESC
        LIMIT 1
      `);

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      this.logger.warn(`Falha ao consultar ultima execucao materializada de ${jobKey}: ${String(error)}`);
      return null;
    }
  }

  async materializeExecution(
    input: MaterializeCronExecutionInput,
  ): Promise<MaterializeCronExecutionResult> {
    const triggeredAt = input.triggeredAt || new Date();
    const metadata = input.metadata ?? {};
    const executionId = randomUUID();

    try {
      const inserted = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        INSERT INTO "cron_materialized_executions" (
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "status",
          "metadata",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${executionId},
          ${input.jobKey},
          ${input.scheduledFor},
          ${triggeredAt},
          'pending',
          ${metadata},
          NOW(),
          NOW()
        )
        ON CONFLICT ("jobKey", "scheduledFor") DO NOTHING
        RETURNING
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
      `);

      if (inserted[0]) {
        return {
          created: true,
          execution: this.mapRow(inserted[0]),
        };
      }

      const existing = await this.getBySlot(input.jobKey, input.scheduledFor);
      if (!existing) {
        throw new Error(
          `Execucao materializada de ${input.jobKey} para ${input.scheduledFor.toISOString()} nao foi encontrada apos conflito unico.`,
        );
      }

      return {
        created: false,
        execution: existing,
      };
    } catch (error) {
      this.logger.error(
        `Falha ao materializar execucao de ${input.jobKey} para ${input.scheduledFor.toISOString()}: ${String(error)}`,
      );
      throw error;
    }
  }

  async claimNextRunnableExecution(
    input: ClaimMaterializedCronExecutionInput,
  ): Promise<MaterializedCronExecutionRecord | null> {
    const ttlMs = Math.max(1, Math.floor(input.ttlMs));

    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        WITH candidate AS (
          SELECT "id"
          FROM "cron_materialized_executions"
          WHERE "jobKey" = ${input.jobKey}
            AND (
              "status" = 'pending'
              OR (
                "status" = 'running'
                AND "lockedUntil" IS NOT NULL
                AND "lockedUntil" <= CURRENT_TIMESTAMP
              )
            )
          ORDER BY "scheduledFor" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "cron_materialized_executions"
        SET
          "status" = 'running',
          "ownerId" = ${input.ownerId},
          "attempt" = "cron_materialized_executions"."attempt" + 1,
          "leaseVersion" = "cron_materialized_executions"."leaseVersion" + 1,
          "startedAt" = CURRENT_TIMESTAMP,
          "finishedAt" = NULL,
          "lockedUntil" = CURRENT_TIMESTAMP + (${ttlMs} * INTERVAL '1 millisecond'),
          "heartbeatAt" = CURRENT_TIMESTAMP,
          "reason" = CASE
            WHEN "cron_materialized_executions"."status" = 'running'
              THEN 'takeover_after_expiration'
            ELSE NULL
          END,
          "error" = NULL,
          "updatedAt" = NOW()
        FROM candidate
        WHERE "cron_materialized_executions"."id" = candidate."id"
        RETURNING
          "cron_materialized_executions"."id",
          "cron_materialized_executions"."jobKey",
          "cron_materialized_executions"."scheduledFor",
          "cron_materialized_executions"."triggeredAt",
          "cron_materialized_executions"."startedAt",
          "cron_materialized_executions"."finishedAt",
          "cron_materialized_executions"."status",
          "cron_materialized_executions"."ownerId",
          "cron_materialized_executions"."attempt",
          "cron_materialized_executions"."leaseVersion",
          "cron_materialized_executions"."lockedUntil",
          "cron_materialized_executions"."heartbeatAt",
          "cron_materialized_executions"."reason",
          "cron_materialized_executions"."error",
          "cron_materialized_executions"."metadata",
          "cron_materialized_executions"."createdAt",
          "cron_materialized_executions"."updatedAt"
      `);

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      this.logger.warn(
        `Falha ao claimar execucao materializada de ${input.jobKey} por ${input.ownerId}: ${String(error)}`,
      );
      return null;
    }
  }

  async renewExecution(
    input: RenewMaterializedCronExecutionInput,
  ): Promise<MaterializedCronExecutionWriteResult> {
    const ttlMs = Math.max(1, Math.floor(input.ttlMs));

    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        UPDATE "cron_materialized_executions"
        SET
          "heartbeatAt" = CURRENT_TIMESTAMP,
          "lockedUntil" = CURRENT_TIMESTAMP + (${ttlMs} * INTERVAL '1 millisecond'),
          "updatedAt" = NOW()
        WHERE "id" = ${input.executionId}
          AND "ownerId" = ${input.ownerId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'running'
          AND "lockedUntil" IS NOT NULL
          AND "lockedUntil" > CURRENT_TIMESTAMP
        RETURNING
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
      `);

      if (rows[0]) {
        return {
          persisted: true,
          execution: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const execution = await this.getById(input.executionId);
      return {
        persisted: false,
        execution,
        reason: this.classifyFailureReason(input, execution),
      };
    } catch (error) {
      this.logger.warn(`Falha ao renovar execucao materializada ${input.executionId}: ${String(error)}`);
      return {
        persisted: false,
        execution: await this.getById(input.executionId),
        reason: 'database_error',
      };
    }
  }

  async finalizeExecution(
    input: FinalizeMaterializedCronExecutionInput,
  ): Promise<MaterializedCronExecutionWriteResult> {
    const finishedAt = input.finishedAt || new Date();
    const reason = input.reason || null;
    const error = this.normalizeError(input.error);

    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        UPDATE "cron_materialized_executions"
        SET
          "status" = ${input.status},
          "finishedAt" = ${finishedAt},
          "heartbeatAt" = ${finishedAt},
          "lockedUntil" = ${finishedAt},
          "reason" = ${reason},
          "error" = ${error},
          "updatedAt" = NOW()
        WHERE "id" = ${input.executionId}
          AND "ownerId" = ${input.ownerId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'running'
        RETURNING
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
      `);

      if (rows[0]) {
        return {
          persisted: true,
          execution: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const execution = await this.getById(input.executionId);
      return {
        persisted: false,
        execution,
        reason: this.classifyFailureReason(input, execution),
      };
    } catch (error) {
      this.logger.warn(`Falha ao finalizar execucao materializada ${input.executionId}: ${String(error)}`);
      return {
        persisted: false,
        execution: await this.getById(input.executionId),
        reason: 'database_error',
      };
    }
  }

  async assertExecutionOwnership(
    input: AssertMaterializedCronExecutionOwnershipInput,
  ): Promise<MaterializedCronExecutionOwnershipResult> {
    try {
      const rows = await this.prisma.$queryRaw<MaterializedCronExecutionRow[]>(Prisma.sql`
        SELECT
          "id",
          "jobKey",
          "scheduledFor",
          "triggeredAt",
          "startedAt",
          "finishedAt",
          "status",
          "ownerId",
          "attempt",
          "leaseVersion",
          "lockedUntil",
          "heartbeatAt",
          "reason",
          "error",
          "metadata",
          "createdAt",
          "updatedAt"
        FROM "cron_materialized_executions"
        WHERE "id" = ${input.executionId}
          AND "ownerId" = ${input.ownerId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'running'
          AND "lockedUntil" IS NOT NULL
          AND "lockedUntil" > CURRENT_TIMESTAMP
      `);

      if (rows[0]) {
        return {
          owned: true,
          execution: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const execution = await this.getById(input.executionId);
      return {
        owned: false,
        execution,
        reason: this.classifyFailureReason(input, execution),
      };
    } catch (error) {
      this.logger.warn(`Falha ao verificar ownership da execucao ${input.executionId}: ${String(error)}`);
      return {
        owned: false,
        execution: await this.getById(input.executionId),
        reason: 'database_error',
      };
    }
  }

  private normalizeError(error: unknown): string | null {
    if (error === null || error === undefined) {
      return null;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim().slice(0, 500);
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim().slice(0, 500);
    }

    return String(error).slice(0, 500);
  }

  private classifyFailureReason(
    input:
      | AssertMaterializedCronExecutionOwnershipInput
      | FinalizeMaterializedCronExecutionInput
      | RenewMaterializedCronExecutionInput,
    execution: MaterializedCronExecutionRecord | null,
  ): MaterializedCronExecutionFailureReason {
    if (!execution) {
      return 'not_found';
    }

    if (execution.leaseVersion !== input.leaseVersion) {
      return 'fencing_mismatch';
    }

    if (execution.ownerId !== input.ownerId) {
      return 'ownership_mismatch';
    }

    if (execution.status !== 'running') {
      return 'terminal_state';
    }

    if (execution.lockedUntil && execution.lockedUntil.getTime() <= Date.now()) {
      return 'lease_expired';
    }

    return 'not_runnable';
  }

  private mapRow(row: MaterializedCronExecutionRow): MaterializedCronExecutionRecord {
    return {
      id: row.id,
      jobKey: row.jobKey,
      scheduledFor: row.scheduledFor,
      triggeredAt: row.triggeredAt,
      startedAt: row.startedAt || null,
      finishedAt: row.finishedAt || null,
      status: this.normalizeStatus(row.status),
      ownerId: row.ownerId || null,
      attempt: typeof row.attempt === 'bigint' ? Number(row.attempt) : Number(row.attempt || 0),
      leaseVersion: this.normalizeLeaseVersion(row.leaseVersion),
      lockedUntil: row.lockedUntil || null,
      heartbeatAt: row.heartbeatAt || null,
      reason: row.reason || null,
      error: row.error || null,
      metadata: row.metadata ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private normalizeLeaseVersion(value: bigint | number | string): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      return BigInt(value);
    }
    return BigInt(String(value));
  }

  private normalizeStatus(value: string): MaterializedCronExecutionStatus {
    switch (value) {
      case 'running':
      case 'success':
      case 'failed':
      case 'skipped':
      case 'superseded':
      case 'aborted':
        return value;
      default:
        return 'pending';
    }
  }
}
