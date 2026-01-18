import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CronService } from '@core/cron/cron.service';

/**
 * Serviço de CronJob para verificação automática de atualizações
 * 
 * Agora usa o sistema de Cron Dinâmico
 */
@Injectable()
export class UpdateCronService implements OnModuleInit {
  private readonly logger = new Logger(UpdateCronService.name);

  constructor(
    private updateService: UpdateService,
    private prisma: PrismaService,
    private cronService: CronService, // Injeta o novo serviço
  ) {
    // Empty implementation
  }

  onModuleInit() {
    // Registra os jobs no sistema dinâmico
    this.registerUpdateCheckJob();
    this.registerLogCleanupJob();
  }

  private registerUpdateCheckJob() {
    this.cronService.register(
      'system.update_check',
      CronExpression.EVERY_DAY_AT_MIDNIGHT,
      async () => {
        try {
          this.logger.log('Iniciando verificação automática de atualizações...');
          const result = await this.updateService.checkForUpdates();
          if (result.updateAvailable) {
            this.logger.log(`Nova versão disponível: ${result.availableVersion}`);
          } else {
            this.logger.log('Sistema está atualizado');
          }
        } catch (error) {
          this.logger.error('Erro na verificação automática de atualizações:', error);
        }
      },
      {
        name: 'Verificar Atualizações',
        description: 'Verifica diariamente se há novas versões do sistema disponíveis no Git.'
      }
    );
  }

  private registerLogCleanupJob() {
    this.cronService.register(
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
        name: 'Limpeza de Logs',
        description: 'Remove logs de atualização com mais de 90 dias.'
      }
    );
  }
}
