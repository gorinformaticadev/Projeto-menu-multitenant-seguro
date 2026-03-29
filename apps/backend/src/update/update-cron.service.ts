import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CronService } from '@core/cron/cron.service';
import { UpdateExecutionBridgeService } from './engine/update-execution-bridge.service';
import { UpdateExecutionFacadeService } from './engine/update-execution.facade.service';

@Injectable()
export class UpdateCronService implements OnModuleInit {
  private readonly logger = new Logger(UpdateCronService.name);

  constructor(
    private readonly updateService: UpdateService,
    private readonly prisma: PrismaService,
    private readonly cronService: CronService,
    private readonly updateExecutionFacadeService?: UpdateExecutionFacadeService,
    private readonly updateExecutionBridgeService?: UpdateExecutionBridgeService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerUpdateCheckJob();
    await this.registerLogCleanupJob();
    await this.registerCanonicalSyncJob();
    await this.registerCanonicalCleanupJob();
  }

  private async registerUpdateCheckJob(): Promise<void> {
    await this.cronService.register(
      'system.update_check',
      CronExpression.EVERY_DAY_AT_MIDNIGHT,
      async () => {
        try {
          this.logger.log('Iniciando verificacao automatica de atualizacoes...');
          const result = await this.updateService.checkForUpdates();
          if (result.updateAvailable) {
            this.logger.log(`Nova versao disponivel: ${result.availableVersion}`);
          } else {
            this.logger.log('Sistema esta atualizado');
          }
        } catch (error) {
          this.logger.error('Erro na verificacao automatica de atualizacoes:', error);
        }
      },
      {
        name: 'Verificar atualizacoes',
        description: 'Verifica diariamente se ha novas versoes do sistema no Git.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private async registerLogCleanupJob(): Promise<void> {
    await this.cronService.register(
      'system.log_cleanup',
      CronExpression.EVERY_WEEK,
      async () => {
        try {
          this.logger.log('Iniciando limpeza de logs antigos...');
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90);

          const logsToDelete = await this.prisma.updateLog.count({
            where: { startedAt: { lt: cutoffDate } },
          });

          if (logsToDelete > 0) {
            await this.prisma.updateLog.deleteMany({
              where: { startedAt: { lt: cutoffDate } },
            });
            this.logger.log(`Removidos ${logsToDelete} logs antigos (>90 dias)`);
          }
        } catch (error) {
          this.logger.error('Erro na limpeza de logs:', error);
        }
      },
      {
        name: 'Limpeza de logs',
        description: 'Remove logs de atualizacao com mais de 90 dias.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private async registerCanonicalSyncJob(): Promise<void> {
    await this.cronService.register(
      'system.update_canonical_sync',
      CronExpression.EVERY_30_SECONDS,
      async () => {
        if (!this.updateExecutionBridgeService?.isEnabled() || !this.updateExecutionFacadeService) {
          return;
        }

        try {
          const current = await this.updateExecutionFacadeService.getCurrentExecutionView();
          if (!current) {
            return;
          }

          await this.updateExecutionBridgeService.syncCurrentLegacyBridgeExecution(current);
        } catch (error) {
          this.logger.warn(`Falha ao sincronizar update canonico com o legado: ${String(error)}`);
        }
      },
      {
        name: 'Sincronizar update canônico',
        description: 'Sincroniza a execução canônica do update com o bridge legado durante a migração.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private async registerCanonicalCleanupJob(): Promise<void> {
    await this.cronService.register(
      'system.update_canonical_cleanup',
      CronExpression.EVERY_WEEK,
      async () => {
        try {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90);

          await this.prisma.$executeRaw`
            DELETE FROM ops_update.command_runs
            WHERE execution_id IN (
              SELECT id
              FROM ops_update.executions
              WHERE finished_at IS NOT NULL
                AND finished_at < ${cutoffDate}
            )
          `;

          await this.prisma.$executeRaw`
            DELETE FROM ops_update.step_runs
            WHERE execution_id IN (
              SELECT id
              FROM ops_update.executions
              WHERE finished_at IS NOT NULL
                AND finished_at < ${cutoffDate}
            )
          `;

          await this.prisma.$executeRaw`
            DELETE FROM ops_update.env_snapshots
            WHERE execution_id IN (
              SELECT id
              FROM ops_update.executions
              WHERE finished_at IS NOT NULL
                AND finished_at < ${cutoffDate}
            )
          `;

          await this.prisma.$executeRaw`
            DELETE FROM ops_update.release_snapshots
            WHERE execution_id IN (
              SELECT id
              FROM ops_update.executions
              WHERE finished_at IS NOT NULL
                AND finished_at < ${cutoffDate}
            )
          `;

          await this.prisma.$executeRaw`
            DELETE FROM ops_update.executions
            WHERE finished_at IS NOT NULL
              AND finished_at < ${cutoffDate}
          `;
        } catch (error) {
          this.logger.warn(`Falha ao limpar execuções canônicas antigas: ${String(error)}`);
        }
      },
      {
        name: 'Limpeza do update canônico',
        description: 'Remove execuções canônicas encerradas com mais de 90 dias.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }
}
