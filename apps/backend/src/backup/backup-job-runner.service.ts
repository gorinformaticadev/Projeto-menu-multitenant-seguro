import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackupJobStatus } from '@prisma/client';
import { BackupConfigService } from './backup-config.service';
import { BackupLockService } from './backup-lock.service';
import { BackupService } from './backup.service';

@Injectable()
export class BackupJobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupJobRunnerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private runningJobId: string | null = null;
  private shuttingDown = false;

  constructor(
    private readonly backupConfig: BackupConfigService,
    private readonly backupService: BackupService,
    private readonly backupLock: BackupLockService,
  ) {}

  onModuleInit(): void {
    const pollMs = this.backupConfig.getQueuePollMs();
    this.pollTimer = setInterval(() => {
      void this.tick();
    }, pollMs);
    this.pollTimer.unref?.();
    this.logger.log(`Backup job runner iniciado (poll=${pollMs}ms)`);
  }

  onModuleDestroy(): void {
    this.shuttingDown = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    if (this.runningJobId) {
      return;
    }

    const job = await this.backupService.claimNextPendingJob();
    if (!job) {
      return;
    }

    this.runningJobId = job.id;
    this.startHeartbeat(job.id);

    try {
      const lockAcquired = await this.backupLock.acquire(job.id, job.type);
      if (!lockAcquired) {
        await this.backupService.returnJobToPending(
          job.id,
          'Job retornou para fila porque outro backup/restore detem o lock global',
        );
        this.logger.warn(`Job ${job.id} reagendado por indisponibilidade do lock global`);
        return;
      }

      await this.backupService.updateJobProgress(job.id, 'RUNNING', 2, 'Job em execucao');
      await this.backupService.executeJob(job.id);
    } catch (error) {
      this.logger.error(`Falha no job ${job.id}: ${String(error)}`);
      await this.backupService.markJobFailed(job.id, error);
    } finally {
      await this.backupLock.release(job.id);
      this.stopHeartbeat();
      this.runningJobId = null;
    }
  }

  private startHeartbeat(jobId: string): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat(jobId);
    }, 5000);
    this.heartbeatTimer.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat(jobId: string): Promise<void> {
    try {
      const job = await this.backupService.getJobStatus(jobId);
      if (job.status !== BackupJobStatus.RUNNING) {
        return;
      }
      await this.backupService.heartbeat(jobId);
      await this.backupLock.heartbeat(jobId);
    } catch (error) {
      this.logger.warn(`Heartbeat do job ${jobId} falhou: ${String(error)}`);
    }
  }
}
