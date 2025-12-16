import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpdateService } from './update.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Serviço de CronJob para verificação automática de atualizações
 * 
 * Executa diariamente à meia-noite para verificar se há novas versões
 * disponíveis no repositório Git configurado
 */
@Injectable()
export class UpdateCronService {
  private readonly logger = new Logger(UpdateCronService.name);

  constructor(
    private updateService: UpdateService,
    private prisma: PrismaService,
  ) {}

  /**
   * CronJob que executa diariamente à meia-noite
   * Verifica automaticamente por novas versões disponíveis
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUpdateCheck() {
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
  }

  /**
   * CronJob para limpeza de logs antigos (executa semanalmente)
   * Remove logs de atualização com mais de 90 dias
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleLogCleanup() {
    try {
      this.logger.log('Iniciando limpeza de logs antigos...');
      
      // Data limite: 90 dias atrás
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      // Contar logs que serão removidos
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