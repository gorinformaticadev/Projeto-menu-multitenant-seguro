import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  type UpdateExecutionRecord,
  type UpdateExecutionErrorSnapshot,
  type UpdateStepRunRecord,
  type UpdateExecutionMetadata,
  type UpdateExecutionStepView,
} from './update-execution.types';

type ExecutionRow = {
  id: string;
  installation_id: string;
  requested_by: string | null;
  source: string;
  mode: string;
  current_version: string;
  target_version: string;
  status: string;
  current_step: string;
  failed_step: string | null;
  rollback_policy: string;
  progress_units_done: number;
  progress_units_total: number;
  error_json: unknown;
  metadata_json: unknown;
  requested_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  revision: bigint | number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type StepRunRow = {
  id: string;
  execution_id: string;
  step: string;
  ordinal: number;
  attempt: number;
  status: string;
  progress_units_done: number;
  progress_units_total: number;
  result_json: unknown;
  error_json: unknown;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
};

type RunnerLeaseRow = {
  installation_id: string;
  runner_id: string;
  lease_token: string;
  execution_id: string | null;
  heartbeat_at: Date | string;
  expires_at: Date | string;
  metadata_json: unknown;
};

@Injectable()
export class UpdateExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExecution(record: UpdateExecutionRecord): Promise<UpdateExecutionRecord> {
    const rows = await this.prisma.$queryRaw<ExecutionRow[]>(Prisma.sql`
      INSERT INTO ops_update.executions (
        id,
        installation_id,
        requested_by,
        source,
        mode,
        current_version,
        target_version,
        status,
        current_step,
        failed_step,
        rollback_policy,
        progress_units_done,
        progress_units_total,
        error_json,
        metadata_json,
        requested_at,
        started_at,
        finished_at,
        revision,
        created_at,
        updated_at
      )
      VALUES (
        ${record.id},
        ${record.installationId},
        ${record.requestedBy},
        ${record.source},
        ${record.mode},
        ${record.currentVersion},
        ${record.targetVersion},
        ${record.status},
        ${record.currentStep},
        ${record.failedStep},
        ${record.rollbackPolicy},
        ${record.progressUnitsDone},
        ${record.progressUnitsTotal},
        ${this.jsonParam(record.error)},
        ${this.jsonParam(record.metadata)},
        ${this.timestampParam(record.requestedAt)},
        ${this.timestampParam(record.startedAt)},
        ${this.timestampParam(record.finishedAt)},
        ${record.revision},
        ${this.timestampParam(record.createdAt)},
        ${this.timestampParam(record.updatedAt)}
      )
      RETURNING *
    `);

    return this.mapExecutionRow(rows[0]);
  }

  async findCurrentExecution(installationId: string): Promise<UpdateExecutionRecord | null> {
    const rows = await this.prisma.$queryRaw<ExecutionRow[]>(Prisma.sql`
      SELECT *
      FROM ops_update.executions
      WHERE installation_id = ${installationId}
        AND status IN ('requested', 'running', 'rollback')
      ORDER BY requested_at DESC
      LIMIT 1
    `);

    if (rows.length === 0) {
      return null;
    }

    return this.mapExecutionRow(rows[0]);
  }

  async findExecutionById(id: string): Promise<UpdateExecutionRecord | null> {
    const rows = await this.prisma.$queryRaw<ExecutionRow[]>(Prisma.sql`
      SELECT *
      FROM ops_update.executions
      WHERE id = ${id}
      LIMIT 1
    `);

    if (rows.length === 0) {
      return null;
    }

    return this.mapExecutionRow(rows[0]);
  }

  async findNextRequestedExecution(installationId: string): Promise<UpdateExecutionRecord | null> {
    const rows = await this.prisma.$queryRaw<ExecutionRow[]>(Prisma.sql`
      SELECT *
      FROM ops_update.executions
      WHERE installation_id = ${installationId}
        AND status = 'requested'
      ORDER BY requested_at ASC
      LIMIT 1
    `);

    if (rows.length === 0) {
      return null;
    }

    return this.mapExecutionRow(rows[0]);
  }

  async listStepRuns(executionId: string): Promise<UpdateStepRunRecord[]> {
    const rows = await this.prisma.$queryRaw<StepRunRow[]>(Prisma.sql`
      SELECT *
      FROM ops_update.step_runs
      WHERE execution_id = ${executionId}
      ORDER BY ordinal ASC, attempt ASC, created_at ASC
    `);

    return rows.map((row) => this.mapStepRunRow(row));
  }

  async updateExecution(
    id: string,
    patch: {
      status?: UpdateExecutionRecord['status'];
      currentStep?: UpdateExecutionRecord['currentStep'];
      failedStep?: UpdateExecutionRecord['failedStep'];
      progressUnitsDone?: number;
      progressUnitsTotal?: number;
      error?: UpdateExecutionErrorSnapshot | null;
      metadata?: UpdateExecutionMetadata;
      startedAt?: string | null;
      finishedAt?: string | null;
    },
  ): Promise<UpdateExecutionRecord> {
    const assignments: Prisma.Sql[] = [
      Prisma.sql`revision = revision + 1`,
      Prisma.sql`updated_at = NOW()`,
    ];

    if (patch.status !== undefined) {
      assignments.push(Prisma.sql`status = ${patch.status}`);
    }
    if (patch.currentStep !== undefined) {
      assignments.push(Prisma.sql`current_step = ${patch.currentStep}`);
    }
    if (patch.failedStep !== undefined) {
      assignments.push(Prisma.sql`failed_step = ${patch.failedStep}`);
    }
    if (patch.progressUnitsDone !== undefined) {
      assignments.push(Prisma.sql`progress_units_done = ${patch.progressUnitsDone}`);
    }
    if (patch.progressUnitsTotal !== undefined) {
      assignments.push(Prisma.sql`progress_units_total = ${patch.progressUnitsTotal}`);
    }
    if (patch.error !== undefined) {
      assignments.push(Prisma.sql`error_json = ${this.jsonParam(patch.error)}`);
    }
    if (patch.metadata !== undefined) {
      assignments.push(
        Prisma.sql`metadata_json = COALESCE(metadata_json, '{}'::jsonb) || ${this.jsonParam(patch.metadata)}`,
      );
    }
    if (patch.startedAt !== undefined) {
      assignments.push(Prisma.sql`started_at = ${this.timestampParam(patch.startedAt)}`);
    }
    if (patch.finishedAt !== undefined) {
      assignments.push(Prisma.sql`finished_at = ${this.timestampParam(patch.finishedAt)}`);
    }

    const rows = await this.prisma.$queryRaw<ExecutionRow[]>(Prisma.sql`
      UPDATE ops_update.executions
      SET ${Prisma.join(assignments, ', ')}
      WHERE id = ${id}
      RETURNING *
    `);

    return this.mapExecutionRow(rows[0]);
  }

  async upsertProjectedSteps(
    executionId: string,
    steps: UpdateExecutionStepView[],
  ): Promise<void> {
    for (const step of steps) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO ops_update.step_runs (
          id,
          execution_id,
          step,
          ordinal,
          attempt,
          status,
          progress_units_done,
          progress_units_total,
          result_json,
          error_json,
          started_at,
          finished_at
        )
        VALUES (
          ${randomUUID()},
          ${executionId},
          ${step.step},
          ${step.ordinal},
          1,
          ${step.status},
          ${step.progressUnitsDone},
          ${step.progressUnitsTotal},
          ${this.jsonParam(step.result)},
          ${this.jsonParam(step.error)},
          ${this.timestampParam(step.startedAt)},
          ${this.timestampParam(step.finishedAt)}
        )
        ON CONFLICT (execution_id, step, attempt)
        DO UPDATE SET
          ordinal = EXCLUDED.ordinal,
          status = EXCLUDED.status,
          progress_units_done = EXCLUDED.progress_units_done,
          progress_units_total = EXCLUDED.progress_units_total,
          result_json = EXCLUDED.result_json,
          error_json = EXCLUDED.error_json,
          started_at = EXCLUDED.started_at,
          finished_at = EXCLUDED.finished_at
      `);
    }
  }

  async tryAcquireRunnerLease(params: {
    installationId: string;
    runnerId: string;
    leaseToken: string;
    executionId?: string | null;
    ttlSeconds: number;
    metadata?: UpdateExecutionMetadata;
  }): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<RunnerLeaseRow[]>(Prisma.sql`
      INSERT INTO ops_update.runner_leases (
        installation_id,
        runner_id,
        lease_token,
        execution_id,
        heartbeat_at,
        expires_at,
        metadata_json
      )
      VALUES (
        ${params.installationId},
        ${params.runnerId},
        ${params.leaseToken},
        ${params.executionId || null},
        NOW(),
        NOW() + (${params.ttlSeconds} * INTERVAL '1 second'),
        ${this.jsonParam(params.metadata || {})}
      )
      ON CONFLICT (installation_id)
      DO UPDATE SET
        runner_id = EXCLUDED.runner_id,
        lease_token = EXCLUDED.lease_token,
        execution_id = EXCLUDED.execution_id,
        heartbeat_at = NOW(),
        expires_at = NOW() + (${params.ttlSeconds} * INTERVAL '1 second'),
        metadata_json = EXCLUDED.metadata_json
      WHERE ops_update.runner_leases.expires_at < NOW()
         OR ops_update.runner_leases.runner_id = EXCLUDED.runner_id
      RETURNING *
    `);

    return rows.length > 0;
  }

  async renewRunnerLease(params: {
    installationId: string;
    runnerId: string;
    executionId?: string | null;
    ttlSeconds: number;
    metadata?: UpdateExecutionMetadata;
  }): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<RunnerLeaseRow[]>(Prisma.sql`
      UPDATE ops_update.runner_leases
      SET
        execution_id = ${params.executionId || null},
        heartbeat_at = NOW(),
        expires_at = NOW() + (${params.ttlSeconds} * INTERVAL '1 second'),
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || ${this.jsonParam(params.metadata || {})}
      WHERE installation_id = ${params.installationId}
        AND runner_id = ${params.runnerId}
      RETURNING *
    `);

    return rows.length > 0;
  }

  async releaseRunnerLease(installationId: string, runnerId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM ops_update.runner_leases
      WHERE installation_id = ${installationId}
        AND runner_id = ${runnerId}
    `);
  }

  private mapExecutionRow(row: ExecutionRow): UpdateExecutionRecord {
    return {
      id: row.id,
      installationId: row.installation_id,
      requestedBy: row.requested_by,
      source: row.source as UpdateExecutionRecord['source'],
      mode: row.mode as UpdateExecutionRecord['mode'],
      currentVersion: row.current_version,
      targetVersion: row.target_version,
      status: row.status as UpdateExecutionRecord['status'],
      currentStep: row.current_step as UpdateExecutionRecord['currentStep'],
      failedStep: row.failed_step as UpdateExecutionRecord['failedStep'],
      rollbackPolicy: row.rollback_policy as UpdateExecutionRecord['rollbackPolicy'],
      progressUnitsDone: Number(row.progress_units_done || 0),
      progressUnitsTotal: Number(row.progress_units_total || 0),
      error: this.parseJsonField<UpdateExecutionErrorSnapshot>(row.error_json),
      metadata: this.parseJsonField<UpdateExecutionMetadata>(row.metadata_json) || {},
      requestedAt: this.toIso(row.requested_at),
      startedAt: this.toNullableIso(row.started_at),
      finishedAt: this.toNullableIso(row.finished_at),
      revision: Number(row.revision || 1),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private mapStepRunRow(row: StepRunRow): UpdateStepRunRecord {
    return {
      id: row.id,
      executionId: row.execution_id,
      step: row.step as UpdateStepRunRecord['step'],
      ordinal: Number(row.ordinal || 0),
      attempt: Number(row.attempt || 1),
      status: row.status as UpdateStepRunRecord['status'],
      progressUnitsDone: Number(row.progress_units_done || 0),
      progressUnitsTotal: Number(row.progress_units_total || 0),
      result: this.parseJsonField<Record<string, unknown>>(row.result_json),
      error: this.parseJsonField<UpdateExecutionErrorSnapshot>(row.error_json),
      startedAt: this.toNullableIso(row.started_at),
      finishedAt: this.toNullableIso(row.finished_at),
      createdAt: this.toIso(row.created_at),
    };
  }

  private parseJsonField<T>(value: unknown): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }

    return value as T;
  }

  private toIso(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(String(value)).toISOString();
  }

  private toNullableIso(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    return this.toIso(value);
  }

  private jsonParam(value: unknown): Prisma.Sql {
    return Prisma.sql`${JSON.stringify(value ?? null)}::jsonb`;
  }

  private timestampParam(value: string | null): Prisma.Sql {
    if (!value) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${value}::timestamptz`;
  }
}
