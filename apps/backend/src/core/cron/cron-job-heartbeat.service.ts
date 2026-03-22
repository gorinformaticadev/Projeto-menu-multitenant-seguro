import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  /**
   * Marca o inicio da execucao de um ciclo.
   * Aplica Exclusive Guard no Banco para mitigar sobreposicao de ciclos.
   */
  async markStarted(
    jobKey: string,
    startedAt: Date,
    nextExpectedRunAt: Date | null,
    cycleId: string,
    instanceId: string,
    stuckAfterMs = 15 * 60 * 1000 // 15 mins default fallback
  ): Promise<boolean> {
    const fallbackDate = new Date(Date.now() - stuckAfterMs);

    try {
      // 1. Tentar update com Exclusive Guard
      const result = await this.prisma.$executeRaw`
        UPDATE "cron_job_heartbeats"
        SET 
          "lastStartedAt" = ${startedAt},
          "lastHeartbeatAt" = NOW(),
          "lastStatus" = 'running',
          "nextExpectedRunAt" = ${nextExpectedRunAt},
          "cycleId" = ${cycleId},
          "instanceId" = ${instanceId},
          "lastError" = NULL,
          "updatedAt" = NOW()
        WHERE "jobKey" = ${jobKey}
          AND ("lastStatus" != 'running' OR "lastHeartbeatAt" < ${fallbackDate})
      `;

      if (result > 0) {
        return true;
      }

      // 2. Se nao atualizou nenhuma linha, verificar se o registro existe
      const current = await this.get(jobKey);
      if (!current) {
        // Primeira execucao, cria o registro
        try {
          await this.prisma.$executeRaw`
            INSERT INTO "cron_job_heartbeats" (
              "jobKey", "lastStartedAt", "lastHeartbeatAt", "lastStatus", "nextExpectedRunAt", "cycleId", "instanceId", "updatedAt"
            ) VALUES (
              ${jobKey}, ${startedAt}, NOW(), 'running', ${nextExpectedRunAt}, ${cycleId}, ${instanceId}, NOW()
            )
          `;
          return true;
        } catch {
          return false; // Erro de unique/concorrencia ao criar
        }
      }

      // Se existe e o update falhou, a condicao do Guard (nao rodando e nao travado) falhou!
      return false;
    } catch (error) {
      this.logger.error(`Erro ao marcar início de ciclo (markStarted) para ${jobKey}: ${String(error)}`);
      return false;
    }
  }

  /**
   * Atualiza o heartbeat (sinal de vida) para um job em execução.
   */
  async updateHeartbeat(jobKey: string, cycleId?: string, instanceId?: string): Promise<boolean> {
    try {
      if (cycleId && instanceId) {
        const result = await this.prisma.$executeRaw`
          UPDATE "cron_job_heartbeats"
          SET "lastHeartbeatAt" = NOW()
          WHERE "jobKey" = ${jobKey}
            AND "lastStatus" = 'running'
            AND "cycleId" = ${cycleId}
            AND "instanceId" = ${instanceId}
        `;
        return result > 0;
      }

      await this.prisma.$executeRaw`
        UPDATE "cron_job_heartbeats"
        SET "lastHeartbeatAt" = NOW()
        WHERE "jobKey" = ${jobKey} AND "lastStatus" = 'running'
      `;
      return true;
    } catch (error) {
      this.logger.warn(`Falha ao atualizar heartbeat para ${jobKey}: ${String(error)}`);
      return false;
    }
  }

  async markSuccess(
    jobKey: string,
    startedAt: Date,
    finishedAt: Date,
    nextExpectedRunAt: Date | null,
    expectedCycleId?: string,
    expectedInstanceId?: string,
  ): Promise<boolean> {
    if (expectedCycleId && expectedInstanceId) {
      try {
        const result = await this.prisma.$executeRaw`
          UPDATE "cron_job_heartbeats"
          SET
            "lastStartedAt" = ${startedAt},
            "lastHeartbeatAt" = ${finishedAt},
            "lastSucceededAt" = ${finishedAt},
            "lastDurationMs" = ${Math.max(0, finishedAt.getTime() - startedAt.getTime())},
            "lastStatus" = 'success',
            "lastError" = NULL,
            "nextExpectedRunAt" = ${nextExpectedRunAt},
            "consecutiveFailureCount" = 0,
            "updatedAt" = ${finishedAt}
          WHERE "jobKey" = ${jobKey}
            AND "lastStatus" = 'running'
            AND "cycleId" = ${expectedCycleId}
            AND "instanceId" = ${expectedInstanceId}
        `;
        return result > 0;
      } catch (error) {
        this.logger.warn(`Falha ao marcar sucesso guardado para ${jobKey}: ${String(error)}`);
        return false;
      }
    }

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
    return true;
  }

  async markFailure(
    jobKey: string,
    startedAt: Date,
    finishedAt: Date,
    error: unknown,
    nextExpectedRunAt: Date | null,
    expectedCycleId?: string,
    expectedInstanceId?: string,
  ): Promise<boolean> {
    if (expectedCycleId && expectedInstanceId) {
      try {
        const result = await this.prisma.$executeRaw`
          UPDATE "cron_job_heartbeats"
          SET
            "lastStartedAt" = ${startedAt},
            "lastHeartbeatAt" = ${finishedAt},
            "lastFailedAt" = ${finishedAt},
            "lastDurationMs" = ${Math.max(0, finishedAt.getTime() - startedAt.getTime())},
            "lastStatus" = 'failed',
            "lastError" = ${this.normalizeError(error)},
            "nextExpectedRunAt" = ${nextExpectedRunAt},
            "consecutiveFailureCount" = COALESCE("consecutiveFailureCount", 0) + 1,
            "updatedAt" = ${finishedAt}
          WHERE "jobKey" = ${jobKey}
            AND "lastStatus" = 'running'
            AND "cycleId" = ${expectedCycleId}
            AND "instanceId" = ${expectedInstanceId}
        `;
        return result > 0;
      } catch (guardError) {
        this.logger.warn(`Falha ao marcar falha guardada para ${jobKey}: ${String(guardError)}`);
        return false;
      }
    }

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
    return true;
  }

  /**
   * Encontra jobs que estao 'running' há muito tempo sem progresso (stuck orphan)
   * e os recupera para 'failed' para permitir novos ciclos.
   */
  async reconcileOrphans(defaultUnstuckMs = 15 * 60 * 1000): Promise<number> {
    const thresholdDate = new Date(Date.now() - defaultUnstuckMs);
    try {
      const result = await this.prisma.$executeRaw`
        UPDATE "cron_job_heartbeats"
        SET 
          "lastStatus" = 'failed',
          "lastError" = 'STUCK_ORPHAN_RECOVERED',
          "updatedAt" = NOW()
        WHERE "lastStatus" = 'running'
          AND ("lastHeartbeatAt" < ${thresholdDate} OR ("lastHeartbeatAt" IS NULL AND "updatedAt" < ${thresholdDate}))
      `;
      if (result > 0) {
        this.logger.log(`[ORPHAN_RECONCILER] Forçados ${result} jobs travados para FAILED.`);
      }
      return result;
    } catch (error) {
      this.logger.error(`[ORPHAN_RECONCILER] Falha ao reconciliar órfãos: ${String(error)}`);
      return 0;
    }
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
          "lastHeartbeatAt",
          "lastSucceededAt",
          "lastFailedAt",
          "lastDurationMs",
          "lastStatus",
          "lastError",
          "nextExpectedRunAt",
          "consecutiveFailureCount",
          "updatedAt",
          "cycleId",
          "instanceId"
        FROM "cron_job_heartbeats"
      `;
    }

    return this.prisma.$queryRaw<HeartbeatRow[]>`
      SELECT
        "jobKey",
        "lastStartedAt",
        "lastHeartbeatAt",
        "lastSucceededAt",
        "lastFailedAt",
        "lastDurationMs",
        "lastStatus",
        "lastError",
        "nextExpectedRunAt",
        "consecutiveFailureCount",
        "updatedAt",
        "cycleId",
        "instanceId"
      FROM "cron_job_heartbeats"
      WHERE "jobKey" IN (${Prisma.join(jobKeys)})
    `;
  }

  private async persist(record: CronJobHeartbeatRecord): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "cron_job_heartbeats" (
        "jobKey",
        "lastStartedAt",
        "lastHeartbeatAt",
        "lastSucceededAt",
        "lastFailedAt",
        "lastDurationMs",
        "lastStatus",
        "lastError",
        "nextExpectedRunAt",
        "consecutiveFailureCount",
        "updatedAt",
        "cycleId",
        "instanceId"
      ) VALUES (
        ${record.jobKey},
        ${record.lastStartedAt},
        ${record.lastHeartbeatAt},
        ${record.lastSucceededAt},
        ${record.lastFailedAt},
        ${record.lastDurationMs},
        ${record.lastStatus},
        ${record.lastError},
        ${record.nextExpectedRunAt},
        ${record.consecutiveFailureCount},
        ${record.updatedAt},
        ${record.cycleId || null},
        ${record.instanceId || null}
      )
      ON CONFLICT ("jobKey") DO UPDATE SET
        "lastStartedAt" = EXCLUDED."lastStartedAt",
        "lastHeartbeatAt" = EXCLUDED."lastHeartbeatAt",
        "lastSucceededAt" = EXCLUDED."lastSucceededAt",
        "lastFailedAt" = EXCLUDED."lastFailedAt",
        "lastDurationMs" = EXCLUDED."lastDurationMs",
        "lastStatus" = EXCLUDED."lastStatus",
        "lastError" = EXCLUDED."lastError",
        "nextExpectedRunAt" = EXCLUDED."nextExpectedRunAt",
        "consecutiveFailureCount" = EXCLUDED."consecutiveFailureCount",
        "updatedAt" = EXCLUDED."updatedAt",
        "cycleId" = EXCLUDED."cycleId",
        "instanceId" = EXCLUDED."instanceId"
    `;
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
