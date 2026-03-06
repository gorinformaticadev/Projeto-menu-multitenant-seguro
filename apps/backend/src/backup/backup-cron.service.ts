import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CronService } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { BackupService } from './backup.service';

@Injectable()
export class BackupCronService implements OnModuleInit {
  private readonly logger = new Logger(BackupCronService.name);
  private static readonly DEFAULT_BACKUP_CRON = '0 2 * * *';
  private static readonly DEFAULT_RETENTION_CRON = '30 2 * * *';

  constructor(
    private readonly backupService: BackupService,
    private readonly cronService: CronService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registerAutomaticBackupJob();
    this.registerRetentionJob();
  }

  private registerAutomaticBackupJob() {
    this.cronService.register(
      'system.backup_auto_create',
      BackupCronService.DEFAULT_BACKUP_CRON,
      async () => {
        const superAdmin = await this.prisma.user.findFirst({
          where: { role: Role.SUPER_ADMIN },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

        if (!superAdmin) {
          this.logger.warn('Backup automatico ignorado: nenhum SUPER_ADMIN disponivel');
          return;
        }

        await this.backupService.createBackupJob(superAdmin.id, {
          ipAddress: '127.0.0.1',
          userAgent: 'cron/system.backup_auto_create',
          source: 'cron',
        });
      },
      {
        name: 'Backup Automatico',
        description: 'Enfileira backup automatico do banco.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private registerRetentionJob() {
    this.cronService.register(
      'system.backup_retention',
      BackupCronService.DEFAULT_RETENTION_CRON,
      async () => {
        await this.backupService.applyRetentionPolicy();
      },
      {
        name: 'Retencao de Backups',
        description: 'Remove backups antigos conforme BACKUP_RETENTION_COUNT.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }
}
