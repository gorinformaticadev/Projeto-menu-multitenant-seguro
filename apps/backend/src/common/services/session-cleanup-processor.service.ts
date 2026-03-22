import { Injectable, Logger } from '@nestjs/common';
import type { CronJobExecutionContext } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class SessionCleanupProcessorService {
  private readonly logger = new Logger(SessionCleanupProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupExpiredSessions(execution?: CronJobExecutionContext): Promise<void> {
    this.logger.log('Starting cleanup of expired user sessions in batches...');

    try {
      let totalRemoved = 0;
      const batchSize = 1000;

      while (true) {
        execution?.throwIfAborted();
        await execution?.assertLeaseOwnership('before_session_batch_select');

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

        execution?.throwIfAborted();
        await execution?.assertLeaseOwnership('before_session_batch_delete');

        const ids = expiredSessions.map((session) => session.id);
        const result = await this.prisma.userSession.deleteMany({
          where: {
            id: { in: ids },
          },
        });

        totalRemoved += result.count;

        execution?.throwIfAborted();
        await execution?.assertLeaseOwnership('after_session_batch_delete');

        if (result.count === 0) {
          break;
        }
      }

      this.logger.log(`Session cleanup completed: ${totalRemoved} rows removed.`);
    } catch (error) {
      this.logger.error('Error during expired session cleanup.', error as Error);
      throw error;
    }
  }
}
