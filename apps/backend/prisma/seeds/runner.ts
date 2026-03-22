import { PrismaClient, SeedRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { seedRegistry } from './registry';
import { SEED_LOCK_KEY, SEED_LOCK_RETRY_MS, SEED_LOCK_TTL_MS, SEED_LOCK_WAIT_SECONDS } from './defaults';
import {
  SeedModuleDefinition,
  SeedModuleKey,
  SeedModuleResult,
  SeedRunnerOptions,
  SeedRunResult,
} from './types';

const prisma = new PrismaClient();

type LeaseTouchRow = { jobKey: string };
type SeedLeaseContext = {
  jobKey: string;
  ownerId: string;
  cycleId: string;
};

export async function runSeedPipeline(options: SeedRunnerOptions = {}): Promise<SeedRunResult> {
  const executionId = randomUUID();
  const force = options.force === true;
  const mode = options.mode || 'deploy';
  const selectedModules = selectModules(options.modules);
  const leaseContext: SeedLeaseContext = {
    jobKey: SEED_LOCK_KEY,
    ownerId: `${process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown'}:${process.pid}`,
    cycleId: executionId,
  };

  const lockAcquired = await acquireSeedLock(leaseContext);
  if (!lockAcquired) {
    await prisma.$disconnect();
    return {
      executionId,
      lockAcquired: false,
      skippedBecauseLocked: true,
      results: [],
    };
  }

  const results: SeedModuleResult[] = [];
  let leaseLost = false;
  const renewEveryMs = Math.max(1000, Math.min(30000, Math.floor(SEED_LOCK_TTL_MS / 2)));
  const leaseHeartbeat = setInterval(async () => {
    if (leaseLost) {
      return;
    }

    leaseLost = !(await renewSeedLock(leaseContext));
  }, renewEveryMs);

  try {
    for (const moduleDef of selectedModules) {
      if (leaseLost) {
        throw new Error('Seed execution lease lost before pipeline completion');
      }

      const seedKey = `${moduleDef.key}@${moduleDef.version}`;

      const alreadyApplied = await prisma.seedHistory.findFirst({
        where: {
          module: moduleDef.key,
          version: moduleDef.version,
          status: { in: [SeedRunStatus.SUCCESS, SeedRunStatus.FORCED] },
        },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });

      if (alreadyApplied && !force) {
        const skipped = await prisma.seedHistory.create({
          data: {
            executionId,
            seedKey,
            module: moduleDef.key,
            version: moduleDef.version,
            status: SeedRunStatus.SKIPPED,
            force: false,
            host: process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown',
            summary: {
              reason: 'already-applied',
              mode,
            },
          },
        });

        results.push({
          key: moduleDef.key,
          version: moduleDef.version,
          status: 'SKIPPED',
          historyId: skipped.id,
          summary: { created: 0, updated: 0, skipped: 1 },
        });
        continue;
      }

      const startedAtMs = Date.now();
      const started = await prisma.seedHistory.create({
        data: {
          executionId,
          seedKey,
          module: moduleDef.key,
          version: moduleDef.version,
          status: SeedRunStatus.STARTED,
          force,
          host: process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown',
          summary: {
            mode,
          },
        },
      });

      try {
        const summary = await prisma.$transaction((tx) =>
          moduleDef.run({
            tx,
            force,
            now: new Date(),
            mode,
          }),
        );

        const finalStatus = force ? SeedRunStatus.FORCED : SeedRunStatus.SUCCESS;

        await prisma.seedHistory.update({
          where: { id: started.id },
          data: {
            status: finalStatus,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAtMs,
            summary,
          },
        });

        results.push({
          key: moduleDef.key,
          version: moduleDef.version,
          status: force ? 'FORCED' : 'SUCCESS',
          historyId: started.id,
          summary,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.seedHistory.update({
          where: { id: started.id },
          data: {
            status: SeedRunStatus.FAILED,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAtMs,
            error: message,
          },
        });

        results.push({
          key: moduleDef.key,
          version: moduleDef.version,
          status: 'FAILED',
          historyId: started.id,
          error: message,
        });

        throw error;
      }
    }

    return {
      executionId,
      lockAcquired: true,
      skippedBecauseLocked: false,
      results,
    };
  } finally {
    clearInterval(leaseHeartbeat);
    await releaseSeedLock(leaseContext);
    await prisma.$disconnect();
  }
}

export async function hasPendingSeeds(modules?: SeedModuleKey[]): Promise<boolean> {
  const selectedModules = selectModules(modules);

  try {
    for (const moduleDef of selectedModules) {
      const alreadyApplied = await prisma.seedHistory.findFirst({
        where: {
          module: moduleDef.key,
          version: moduleDef.version,
          status: { in: [SeedRunStatus.SUCCESS, SeedRunStatus.FORCED] },
        },
        select: { id: true },
      });

      if (!alreadyApplied) {
        return true;
      }
    }

    return false;
  } finally {
    await prisma.$disconnect();
  }
}

function selectModules(modules?: SeedModuleKey[]): SeedModuleDefinition[] {
  if (!modules || modules.length === 0) {
    return seedRegistry;
  }

  const unique = Array.from(new Set(modules));
  const selected = seedRegistry.filter((moduleDef) => unique.includes(moduleDef.key));

  if (selected.length !== unique.length) {
    const found = new Set(selected.map((item) => item.key));
    const missing = unique.filter((item) => !found.has(item));
    throw new Error(`Modulo de seed desconhecido: ${missing.join(', ')}`);
  }

  return selected;
}

async function acquireSeedLock(context: SeedLeaseContext): Promise<boolean> {
  const timeoutMs = Math.max(1, SEED_LOCK_WAIT_SECONDS) * 1000;
  const retryMs = Math.max(200, SEED_LOCK_RETRY_MS);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const rows = await prisma.$queryRaw<LeaseTouchRow[]>`
      INSERT INTO "execution_leases" (
        "jobKey",
        "ownerId",
        "cycleId",
        "status",
        "startedAt",
        "heartbeatAt",
        "lockedUntil",
        "acquiredAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${context.jobKey},
        ${context.ownerId},
        ${context.cycleId},
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + (${Math.max(1, SEED_LOCK_TTL_MS)} * INTERVAL '1 millisecond'),
        CURRENT_TIMESTAMP,
        NOW(),
        NOW()
      )
      ON CONFLICT ("jobKey") DO UPDATE
      SET
        "ownerId" = EXCLUDED."ownerId",
        "cycleId" = EXCLUDED."cycleId",
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
      RETURNING "jobKey"
    `;
    if (rows.length > 0) {
      return true;
    }
    await sleep(retryMs);
  }

  return false;
}

async function renewSeedLock(context: SeedLeaseContext): Promise<boolean> {
  const rows = await prisma.$queryRaw<LeaseTouchRow[]>`
    UPDATE "execution_leases"
    SET
      "heartbeatAt" = CURRENT_TIMESTAMP,
      "lockedUntil" = CURRENT_TIMESTAMP + (${Math.max(1, SEED_LOCK_TTL_MS)} * INTERVAL '1 millisecond'),
      "updatedAt" = NOW()
    WHERE "jobKey" = ${context.jobKey}
      AND "ownerId" = ${context.ownerId}
      AND "cycleId" = ${context.cycleId}
      AND "status" = 'active'
      AND "lockedUntil" > CURRENT_TIMESTAMP
    RETURNING "jobKey"
  `;
  return rows.length > 0;
}

async function releaseSeedLock(context: SeedLeaseContext): Promise<void> {
  const releasedAt = new Date();
  await prisma.$queryRaw<LeaseTouchRow[]>`
    UPDATE "execution_leases"
    SET
      "status" = 'released',
      "heartbeatAt" = ${releasedAt},
      "lockedUntil" = ${releasedAt},
      "releasedAt" = ${releasedAt},
      "releaseReason" = 'seed_pipeline_completed',
      "updatedAt" = NOW()
    WHERE "jobKey" = ${context.jobKey}
      AND "ownerId" = ${context.ownerId}
      AND "cycleId" = ${context.cycleId}
      AND "status" = 'active'
    RETURNING "jobKey"
  `;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
