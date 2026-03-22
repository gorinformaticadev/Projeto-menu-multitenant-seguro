import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { CronService } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class TokenCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TokenCleanupService.name);
  private static readonly EVERY_15_MINUTES = '0 */15 * * * *';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronService: CronService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cronService.register(
      'system.token_cleanup',
      CronExpression.EVERY_6_HOURS,
      async () => {
        await this.cleanupExpiredTokens();
      },
      {
        name: 'Token cleanup',
        description: 'Remove refresh tokens expirados e antigos automaticamente.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
        databaseLease: {
          enabled: true,
        },
      },
    );

    await this.cronService.register(
      'system.session_cleanup',
      TokenCleanupService.EVERY_15_MINUTES,
      async () => {
        await this.cleanupExpiredSessions();
      },
      {
        name: 'Session cleanup',
        description: 'Remove sessoes expiradas do ledger para manter o runtime stateful consistente.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
        databaseLease: {
          enabled: true,
        },
      },
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    this.logger.log('Starting cleanup of expired refresh tokens...');
    try {
      const now = new Date();
      const trustedDeviceRetentionBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [refreshTokenResult, trustedDeviceResult] = await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({
          where: {
            expiresAt: { lt: now },
          },
        }),
        this.prisma.trustedDevice.deleteMany({
          where: {
            OR: [
              {
                expiresAt: {
                  lt: now,
                },
              },
              {
                revokedAt: {
                  not: null,
                  lt: trustedDeviceRetentionBoundary,
                },
              },
            ],
          },
        }),
      ]);

      this.logger.log(
        `Token cleanup completed: refreshTokens=${refreshTokenResult.count} trustedDevices=${trustedDeviceResult.count}`,
      );
    } catch (error) {
      this.logger.error('Error during expired token cleanup.', error as Error);
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting cleanup of expired user sessions in batches...');
    try {
      let totalRemoved = 0;
      const batchSize = 1000;

      while (true) {
        const expiredSessions = await this.prisma.userSession.findMany({
          where: {
            expiresAt: { lt: new Date() },
          },
          take: batchSize,
          select: { id: true },
        });

        if (expiredSessions.length === 0) {
          break;
        }

        const ids = expiredSessions.map((s) => s.id);
        const result = await this.prisma.userSession.deleteMany({
          where: {
            id: { in: ids },
          },
        });

        totalRemoved += result.count;
        if (result.count === 0) break; // Segurança contra loop infinito
      }

      this.logger.log(`Session cleanup completed: ${totalRemoved} rows removed.`);
    } catch (error) {
      this.logger.error('Error during expired session cleanup.', error as Error);
    }
  }

  async cleanupOldTokens(olderThanDays = 30): Promise<number> {
    this.logger.log(`Cleaning tokens older than ${olderThanDays} days...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: cutoffDate } },
        ],
      },
    });

    this.logger.log(`${result.count} old tokens removed.`);
    return result.count;
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    this.logger.log(`Revoking all tokens for user ${userId}...`);

    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`${result.count} tokens revoked.`);
    return result.count;
  }

  async getTokenStats(): Promise<{
    total: number;
    expired: number;
    active: number;
    expirationRate: string;
  }> {
    const [total, expired, active] = await Promise.all([
      this.prisma.refreshToken.count(),
      this.prisma.refreshToken.count({
        where: {
          expiresAt: { lt: new Date() },
        },
      }),
      this.prisma.refreshToken.count({
        where: {
          expiresAt: { gte: new Date() },
        },
      }),
    ]);

    return {
      total,
      expired,
      active,
      expirationRate: total > 0 ? `${((expired / total) * 100).toFixed(2)}%` : '0%',
    };
  }

}
