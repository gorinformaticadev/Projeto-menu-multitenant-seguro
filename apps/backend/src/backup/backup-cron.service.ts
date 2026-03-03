import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CronService } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { BackupService } from './backup.service';

@Injectable()
export class BackupCronService implements OnModuleInit {
  private readonly logger = new Logger(BackupCronService.name);
  private static readonly DEFAULT_BACKUP_CRON = '0 2 * * *';
  private static readonly DEFAULT_CLEANUP_CRON = '30 2 * * *';
  private static readonly DEFAULT_RETENTION_HOURS = 30 * 24;

  constructor(
    private readonly backupService: BackupService,
    private readonly cronService: CronService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registerAutomaticBackupJob();
    this.registerBackupCleanupJob();
  }

  private registerAutomaticBackupJob() {
    this.cronService.register(
      'system.backup_auto_create',
      BackupCronService.DEFAULT_BACKUP_CRON,
      async () => {
        const automationUser = await this.prisma.user.findFirst({
          where: { role: Role.SUPER_ADMIN },
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true },
        });

        if (!automationUser) {
          this.logger.warn('Automatic backup skipped: no SUPER_ADMIN user found.');
          return;
        }

        try {
          await this.backupService.createBackup(
            { includeMetadata: true, compressionLevel: 'default' },
            automationUser.id,
            '127.0.0.1',
          );
        } catch (error: any) {
          this.logger.error(
            `Automatic backup failed: ${error?.message || String(error)}`,
            error?.stack,
          );
        }
      },
      {
        name: 'Backup Automatico',
        description: 'Cria backup automatico do banco de dados.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private registerBackupCleanupJob() {
    this.cronService.register(
      'system.backup_cleanup',
      BackupCronService.DEFAULT_CLEANUP_CRON,
      async () => {
        await this.backupService.cleanupOldBackups(BackupCronService.DEFAULT_RETENTION_HOURS);
      },
      {
        name: 'Limpeza de Backups',
        description: 'Remove backups expirados com base na politica de retencao.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }
}
