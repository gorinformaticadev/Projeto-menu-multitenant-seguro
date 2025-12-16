import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@core/prisma/prisma.service';

/**
 * ServiÃ§o de limpeza de tokens expirados
 * 
 * Executa tarefas de manutenÃ§Ã£o periÃ³dicas para:
 * - Remover refresh tokens expirados do banco de dados
 * - Limpar sessÃµes antigas
 * - Otimizar armazenamento
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Limpa tokens expirados a cada 6 horas
   * 
   * Executa automaticamente usando cron job
   */
  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'cleanup-expired-tokens',
  })
  async cleanupExpiredTokens() {
    this.logger.log('ðŸ§¹ Iniciando limpeza de refresh tokens expirados...');

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(), // Tokens que expiraram (menor que data atual)
          },
        },
      });

      this.logger.log(`âœ… Limpeza concluÃ­da: ${result.count} tokens removidos`);
    } catch (error) {
      this.logger.error('âŒ Erro ao limpar tokens expirados:', error);
    }
  }

  /**
   * Limpa tokens antigos manualmente (mÃ©todo pÃºblico para admin)
   * 
   * @param olderThanDays - Remove tokens mais antigos que X dias
   * @returns NÃºmero de tokens removidos
   */
  async cleanupOldTokens(olderThanDays: number = 30): Promise<number> {
    this.logger.log(`ðŸ§¹ Limpando tokens mais antigos que ${olderThanDays} dias...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            // Tokens expirados
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            // Tokens muito antigos (mesmo se nÃ£o expirados)
            {
              createdAt: {
                lt: cutoffDate,
              },
            },
          ],
        },
      });

      this.logger.log(`âœ… ${result.count} tokens removidos`);
      return result.count;
    } catch (error) {
      this.logger.error('âŒ Erro ao limpar tokens antigos:', error);
      throw error;
    }
  }

  /**
   * Limpa todos os refresh tokens de um usuÃ¡rio especÃ­fico
   * Ãštil para forÃ§ar logout em todos os dispositivos
   * 
   * @param userId - ID do usuÃ¡rio
   * @returns NÃºmero de tokens removidos
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    this.logger.log(`ðŸ”’ Revogando todos os tokens do usuÃ¡rio ${userId}...`);

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
        },
      });

      this.logger.log(`âœ… ${result.count} tokens revogados`);
      return result.count;
    } catch (error) {
      this.logger.error('âŒ Erro ao revogar tokens do usuÃ¡rio:', error);
      throw error;
    }
  }

  /**
   * ObtÃ©m estatÃ­sticas sobre tokens
   * 
   * @returns EstatÃ­sticas de tokens
   */
  async getTokenStats() {
    const [total, expired, active] = await Promise.all([
      // Total de tokens
      this.prisma.refreshToken.count(),
      
      // Tokens expirados
      this.prisma.refreshToken.count({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      }),
      
      // Tokens ativos
      this.prisma.refreshToken.count({
        where: {
          expiresAt: {
            gte: new Date(),
          },
        },
      }),
    ]);

    return {
      total,
      expired,
      active,
      expirationRate: total > 0 ? ((expired / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

