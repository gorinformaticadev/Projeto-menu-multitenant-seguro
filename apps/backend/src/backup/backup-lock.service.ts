import { Injectable, Logger } from '@nestjs/common';
import { BackupJobType, Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { BackupConfigService } from './backup-config.service';

@Injectable()
export class BackupLockService {
  private readonly logger = new Logger(BackupLockService.name);
  private static readonly LOCK_KEY = 'GLOBAL_BACKUP_RESTORE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfigService,
  ) {}

  async acquire(jobId: string, type: BackupJobType): Promise<boolean> {
    const leaseSeconds = this.backupConfig.getLeaseSeconds();
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; holderJobId: string | null; expiresAt: Date | null }>
    >(Prisma.sql`
      INSERT INTO "backup_leases" ("key", "holderJobId", "operationType", "acquiredAt", "expiresAt", "updatedAt", "metadata")
      VALUES (
        ${BackupLockService.LOCK_KEY},
        ${jobId},
        ${type}::"BackupJobType",
        NOW(),
        NOW() + (${leaseSeconds} * INTERVAL '1 second'),
        NOW(),
        jsonb_build_object('type', ${type}, 'jobId', ${jobId})
      )
      ON CONFLICT ("key")
      DO UPDATE SET
        "holderJobId" = EXCLUDED."holderJobId",
        "operationType" = EXCLUDED."operationType",
        "acquiredAt" = EXCLUDED."acquiredAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW(),
        "metadata" = EXCLUDED."metadata"
      WHERE
        "backup_leases"."expiresAt" IS NULL
        OR "backup_leases"."expiresAt" <= NOW()
        OR "backup_leases"."holderJobId" = EXCLUDED."holderJobId"
      RETURNING "key", "holderJobId", "expiresAt"
    `);

    const lockAcquired = rows.length === 1 && rows[0]?.holderJobId === jobId;
    if (!lockAcquired) {
      this.logger.warn(`Lock indisponivel para job ${jobId}`);
    }
    return lockAcquired;
  }

  async heartbeat(jobId: string): Promise<void> {
    const leaseSeconds = this.backupConfig.getLeaseSeconds();
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "backup_leases"
        SET "expiresAt" = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
            "updatedAt" = NOW()
        WHERE "key" = ${BackupLockService.LOCK_KEY}
          AND "holderJobId" = ${jobId}
      `,
    );
  }

  async release(jobId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "backup_leases"
          SET "holderJobId" = NULL,
              "operationType" = NULL,
              "acquiredAt" = NULL,
              "expiresAt" = NULL,
              "updatedAt" = NOW(),
              "metadata" = NULL
          WHERE "key" = ${BackupLockService.LOCK_KEY}
            AND "holderJobId" = ${jobId}
        `,
      );
    } catch (error) {
      this.logger.warn(`Falha ao liberar lock do job ${jobId}: ${String(error)}`);
    }
  }

  async getState(): Promise<{
    key: string;
    holderJobId: string | null;
    operationType: BackupJobType | null;
    acquiredAt: Date | null;
    expiresAt: Date | null;
  } | null> {
    const lock = await this.prisma.backupLease.findUnique({
      where: { key: BackupLockService.LOCK_KEY },
      select: {
        key: true,
        holderJobId: true,
        operationType: true,
        acquiredAt: true,
        expiresAt: true,
      },
    });
    return lock;
  }
}
