import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CronService } from '@core/cron/cron.service';

@Injectable()
export class UpdateCronService implements OnModuleInit {
  private readonly logger = new Logger(UpdateCronService.name);

  constructor(
    private readonly updateService: UpdateService,
    private readonly prisma: PrismaService,
    private readonly cronService: CronService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerUpdateCheckJob();
    await this.registerLogCleanupJob();
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
}
