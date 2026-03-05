import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);
  private readonly lockId = Number(process.env.TOKEN_CLEANUP_LOCK_ID || 98542173);
  private readonly advisoryLockEnabled =
    String(process.env.TOKEN_CLEANUP_USE_ADVISORY_LOCK || 'true').toLowerCase() !== 'false';

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'cleanup-expired-tokens',
  })
  async cleanupExpiredTokens(): Promise<void> {
    const lockAcquired = await this.tryAcquireAdvisoryLock();
    if (!lockAcquired) {
      this.logger.log('Token cleanup skipped: lock is held by another instance.');
      return;
    }

    this.logger.log('Starting cleanup of expired refresh tokens...');
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      this.logger.log(`Token cleanup completed: ${result.count} rows removed.`);
    } catch (error) {
      this.logger.error('Error during expired token cleanup.', error as Error);
    } finally {
      await this.releaseAdvisoryLock();
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

  private async tryAcquireAdvisoryLock(): Promise<boolean> {
    if (!this.advisoryLockEnabled) {
      return true;
    }

    try {
      const result = await this.prisma.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(${this.lockId}) AS acquired
      `;
      return result?.[0]?.acquired === true;
    } catch (error) {
      this.logger.warn(`Failed to acquire token cleanup advisory lock: ${String(error)}`);
      return false;
    }
  }

  private async releaseAdvisoryLock(): Promise<void> {
    if (!this.advisoryLockEnabled) {
      return;
    }

    try {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${this.lockId})`;
    } catch (error) {
      this.logger.warn(`Failed to release token cleanup advisory lock: ${String(error)}`);
    }
  }
}
