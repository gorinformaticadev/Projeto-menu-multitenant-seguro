import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  type UpdateExecutionRecord,
  type UpdateExecutionErrorSnapshot,
  type UpdateStepRunRecord,
  type UpdateExecutionMetadata,
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

  async listStepRuns(executionId: string): Promise<UpdateStepRunRecord[]> {
    const rows = await this.prisma.$queryRaw<StepRunRow[]>(Prisma.sql`
      SELECT *
      FROM ops_update.step_runs
      WHERE execution_id = ${executionId}
      ORDER BY ordinal ASC, attempt ASC, created_at ASC
    `);

    return rows.map((row) => this.mapStepRunRow(row));
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
