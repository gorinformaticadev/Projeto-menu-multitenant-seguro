import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';

/**
 * ServiÃ§o de CronJob para verificaÃ§Ã£o automÃ¡tica de atualizaÃ§Ãµes
 * 
 * Executa diariamente Ã  meia-noite para verificar se hÃ¡ novas versÃµes
 * disponÃ­veis no repositÃ³rio Git configurado
 */
@Injectable()
export class UpdateCronService {
  private readonly logger = new Logger(UpdateCronService.name);

  constructor(
    private updateService: UpdateService,
    private prisma: PrismaService,
  ) {}

  /**
   * CronJob que executa diariamente Ã  meia-noite
   * Verifica automaticamente por novas versÃµes disponÃ­veis
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUpdateCheck() {
    try {
      this.logger.log('Iniciando verificaÃ§Ã£o automÃ¡tica de atualizaÃ§Ãµes...');
      
      const result = await this.updateService.checkForUpdates();
      
      if (result.updateAvailable) {
        this.logger.log(`Nova versÃ£o disponÃ­vel: ${result.availableVersion}`);
      } else {
        this.logger.log('Sistema estÃ¡ atualizado');
      }
      
    } catch (error) {
      this.logger.error('Erro na verificaÃ§Ã£o automÃ¡tica de atualizaÃ§Ãµes:', error);
    }
  }

  /**
   * CronJob para limpeza de logs antigos (executa semanalmente)
   * Remove logs de atualizaÃ§Ã£o com mais de 90 dias
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleLogCleanup() {
    try {
      this.logger.log('Iniciando limpeza de logs antigos...');
      
      // Data limite: 90 dias atrÃ¡s
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      // Contar logs que serÃ£o removidos
      const logsToDelete = await (this.prisma as any).updateLog.count({
        where: {
          startedAt: {
            lt: cutoffDate,
          },
        },
      });
      
      if (logsToDelete > 0) {
        // Remover logs antigos
        await (this.prisma as any).updateLog.deleteMany({
          where: {
            startedAt: {
              lt: cutoffDate,
            },
          },
        });
        
        this.logger.log(`Removidos ${logsToDelete} logs antigos (>90 dias)`);
      } else {
        this.logger.log('Nenhum log antigo para remover');
      }
      
    } catch (error) {
      this.logger.error('Erro na limpeza de logs:', error);
    }
  }
}
