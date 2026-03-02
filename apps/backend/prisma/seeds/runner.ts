import { PrismaClient, SeedRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { seedRegistry } from './registry';
import { SEED_ADVISORY_LOCK_ID } from './defaults';
import {
  SeedModuleDefinition,
  SeedModuleKey,
  SeedModuleResult,
  SeedRunnerOptions,
  SeedRunResult,
} from './types';

const prisma = new PrismaClient();

type LockRow = { locked: boolean };

export async function runSeedPipeline(options: SeedRunnerOptions = {}): Promise<SeedRunResult> {
  const executionId = randomUUID();
  const force = options.force === true;
  const mode = options.mode || 'deploy';
  const selectedModules = selectModules(options.modules);

  const lockAcquired = await acquireSeedLock();
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

  try {
    for (const moduleDef of selectedModules) {
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
    await releaseSeedLock();
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

async function acquireSeedLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<LockRow[]>`SELECT pg_try_advisory_lock(${SEED_ADVISORY_LOCK_ID}) AS locked`;
  return rows[0]?.locked === true;
}

async function releaseSeedLock(): Promise<void> {
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${SEED_ADVISORY_LOCK_ID})`;
}
