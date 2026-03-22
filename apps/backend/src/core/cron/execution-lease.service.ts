import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ExecutionLeaseStatus = 'active' | 'released';
export type ExecutionLeaseFailureReason =
  | 'not_found'
  | 'ownership_mismatch'
  | 'fencing_mismatch'
  | 'inactive'
  | 'stale_execution'
  | 'database_error';

export interface ExecutionLeaseRecord {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  leaseVersion: bigint;
  status: ExecutionLeaseStatus;
  startedAt: Date;
  heartbeatAt: Date;
  lockedUntil: Date;
  acquiredAt: Date;
  releasedAt: Date | null;
  releaseReason: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcquireExecutionLeaseInput {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  startedAt: Date;
  ttlMs: number;
}

export interface AcquireExecutionLeaseResult {
  acquired: boolean;
  lease: ExecutionLeaseRecord | null;
}

export interface RenewExecutionLeaseInput {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  leaseVersion: bigint;
  heartbeatAt?: Date;
  ttlMs: number;
}

export interface ReleaseExecutionLeaseInput {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  leaseVersion: bigint;
  releasedAt?: Date;
  reason: string;
  error?: unknown;
}

export interface AssertExecutionLeaseOwnershipInput {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  leaseVersion: bigint;
}

export interface RenewExecutionLeaseResult {
  renewed: boolean;
  lease: ExecutionLeaseRecord | null;
  reason: ExecutionLeaseFailureReason | null;
}

export interface ReleaseExecutionLeaseResult {
  released: boolean;
  lease: ExecutionLeaseRecord | null;
  reason: ExecutionLeaseFailureReason | null;
}

export interface ExecutionLeaseOwnershipResult {
  owned: boolean;
  lease: ExecutionLeaseRecord | null;
  reason: ExecutionLeaseFailureReason | null;
}

type ExecutionLeaseRow = {
  jobKey: string;
  ownerId: string;
  cycleId: string;
  leaseVersion: bigint | number | string;
  status: string;
  startedAt: Date;
  heartbeatAt: Date;
  lockedUntil: Date;
  acquiredAt: Date;
  releasedAt: Date | null;
  releaseReason: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ExecutionLeaseService {
  private readonly logger = new Logger(ExecutionLeaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(jobKey: string): Promise<ExecutionLeaseRecord | null> {
    try {
      const rows = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(Prisma.sql`
        SELECT
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
        FROM "execution_leases"
        WHERE "jobKey" = ${jobKey}
      `);
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      this.logger.warn(`Falha ao consultar lease persistido de ${jobKey}: ${String(error)}`);
      return null;
    }
  }

  async acquireLease(input: AcquireExecutionLeaseInput): Promise<AcquireExecutionLeaseResult> {
    const ttlMs = Math.max(1, Math.floor(input.ttlMs));
    const startedAt = input.startedAt;

    try {
      const rows = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(Prisma.sql`
        INSERT INTO "execution_leases" (
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${input.jobKey},
          ${input.ownerId},
          ${input.cycleId},
          1,
          'active',
          ${startedAt},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + (${ttlMs} * INTERVAL '1 millisecond'),
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          NULL,
          NOW(),
          NOW()
        )
        ON CONFLICT ("jobKey") DO UPDATE
        SET
          "ownerId" = EXCLUDED."ownerId",
          "cycleId" = EXCLUDED."cycleId",
          "leaseVersion" = "execution_leases"."leaseVersion" + 1,
          "status" = 'active',
          "startedAt" = EXCLUDED."startedAt",
          "heartbeatAt" = EXCLUDED."heartbeatAt",
          "lockedUntil" = EXCLUDED."lockedUntil",
          "acquiredAt" = EXCLUDED."acquiredAt",
          "releasedAt" = NULL,
          "releaseReason" = NULL,
          "lastError" = NULL,
          "updatedAt" = NOW()
        WHERE "execution_leases"."lockedUntil" <= CURRENT_TIMESTAMP
          OR "execution_leases"."status" <> 'active'
        RETURNING
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
      `);

      if (rows.length > 0) {
        return {
          acquired: true,
          lease: this.mapRow(rows[0]),
        };
      }

      return {
        acquired: false,
        lease: await this.get(input.jobKey),
      };
    } catch (error) {
      this.logger.warn(`Falha ao adquirir lease persistido de ${input.jobKey}: ${String(error)}`);
      return {
        acquired: false,
        lease: await this.get(input.jobKey),
      };
    }
  }

  async renewLease(input: RenewExecutionLeaseInput): Promise<RenewExecutionLeaseResult> {
    const ttlMs = Math.max(1, Math.floor(input.ttlMs));

    try {
      const rows = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(Prisma.sql`
        UPDATE "execution_leases"
        SET
          "heartbeatAt" = CURRENT_TIMESTAMP,
          "lockedUntil" = CURRENT_TIMESTAMP + (${ttlMs} * INTERVAL '1 millisecond'),
          "updatedAt" = NOW()
        WHERE "jobKey" = ${input.jobKey}
          AND "ownerId" = ${input.ownerId}
          AND "cycleId" = ${input.cycleId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'active'
          AND "lockedUntil" > CURRENT_TIMESTAMP
        RETURNING
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
      `);

      if (rows.length > 0) {
        return {
          renewed: true,
          lease: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const lease = await this.get(input.jobKey);
      return {
        renewed: false,
        lease,
        reason: this.classifyFailureReason(input, lease),
      };
    } catch (error) {
      this.logger.warn(`Falha ao renovar lease persistido de ${input.jobKey}: ${String(error)}`);
      return {
        renewed: false,
        lease: await this.get(input.jobKey),
        reason: 'database_error',
      };
    }
  }

  async releaseLease(input: ReleaseExecutionLeaseInput): Promise<ReleaseExecutionLeaseResult> {
    const releasedAt = input.releasedAt || new Date();
    const lastError = this.normalizeError(input.error);

    try {
      const rows = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(Prisma.sql`
        UPDATE "execution_leases"
        SET
          "status" = 'released',
          "heartbeatAt" = ${releasedAt},
          "lockedUntil" = ${releasedAt},
          "releasedAt" = ${releasedAt},
          "releaseReason" = ${input.reason},
          "lastError" = ${lastError},
          "updatedAt" = NOW()
        WHERE "jobKey" = ${input.jobKey}
          AND "ownerId" = ${input.ownerId}
          AND "cycleId" = ${input.cycleId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'active'
        RETURNING
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
      `);

      if (rows.length > 0) {
        return {
          released: true,
          lease: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const lease = await this.get(input.jobKey);
      return {
        released: false,
        lease,
        reason: this.classifyFailureReason(input, lease),
      };
    } catch (error) {
      this.logger.warn(`Falha ao liberar lease persistido de ${input.jobKey}: ${String(error)}`);
      return {
        released: false,
        lease: await this.get(input.jobKey),
        reason: 'database_error',
      };
    }
  }

  async assertLeaseOwnership(
    input: AssertExecutionLeaseOwnershipInput,
  ): Promise<ExecutionLeaseOwnershipResult> {
    try {
      const rows = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(Prisma.sql`
        SELECT
          "jobKey",
          "ownerId",
          "cycleId",
          "leaseVersion",
          "status",
          "startedAt",
          "heartbeatAt",
          "lockedUntil",
          "acquiredAt",
          "releasedAt",
          "releaseReason",
          "lastError",
          "createdAt",
          "updatedAt"
        FROM "execution_leases"
        WHERE "jobKey" = ${input.jobKey}
          AND "ownerId" = ${input.ownerId}
          AND "cycleId" = ${input.cycleId}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "status" = 'active'
          AND "lockedUntil" > CURRENT_TIMESTAMP
      `);

      if (rows.length > 0) {
        return {
          owned: true,
          lease: this.mapRow(rows[0]),
          reason: null,
        };
      }

      const lease = await this.get(input.jobKey);
      return {
        owned: false,
        lease,
        reason: this.classifyFailureReason(input, lease),
      };
    } catch (error) {
      this.logger.warn(`Falha ao verificar ownership do lease persistido de ${input.jobKey}: ${String(error)}`);
      return {
        owned: false,
        lease: await this.get(input.jobKey),
        reason: 'database_error',
      };
    }
  }

  private normalizeError(error: unknown): string | null {
    if (error === null || error === undefined) {
      return null;
    }
    if (error instanceof Error) {
      return error.message;
    }
    const raw = String(error).trim();
    return raw ? raw : null;
  }

  private mapRow(row: ExecutionLeaseRow): ExecutionLeaseRecord {
      return {
        jobKey: row.jobKey,
        ownerId: row.ownerId,
        cycleId: row.cycleId,
        leaseVersion: this.normalizeLeaseVersion(row.leaseVersion),
        status: row.status === 'active' ? 'active' : 'released',
        startedAt: row.startedAt,
        heartbeatAt: row.heartbeatAt,
      lockedUntil: row.lockedUntil,
      acquiredAt: row.acquiredAt,
      releasedAt: row.releasedAt,
      releaseReason: row.releaseReason,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      };
  }

  private classifyFailureReason(
    input: AssertExecutionLeaseOwnershipInput,
    lease: ExecutionLeaseRecord | null,
  ): ExecutionLeaseFailureReason {
    if (!lease) {
      return 'not_found';
    }
    if (lease.leaseVersion !== input.leaseVersion) {
      return 'fencing_mismatch';
    }
    if (lease.ownerId !== input.ownerId || lease.cycleId !== input.cycleId) {
      return 'ownership_mismatch';
    }
    if (lease.status !== 'active') {
      return 'inactive';
    }
    return 'stale_execution';
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
}
