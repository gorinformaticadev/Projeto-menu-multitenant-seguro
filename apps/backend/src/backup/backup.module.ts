import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { CronModule } from '../core/cron/cron.module';
import { PathsModule } from '../core/common/paths/paths.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { BackupConfigService } from './backup-config.service';
import { BackupInternalController, BackupsController, BackupLegacyController } from './backup.controller';
import { BackupCronService } from './backup-cron.service';
import { BackupJobRunnerService } from './backup-job-runner.service';
import { BackupLockService } from './backup-lock.service';
import { BackupProcessService } from './backup-process.service';
import { BackupRuntimeStateService } from './backup-runtime-state.service';
import { BackupService } from './backup.service';
import { BackupInternalGuard } from './guards/backup-internal.guard';
import { BackupMaintenanceGuard } from './guards/backup-maintenance.guard';
import { LegacyBackupDeprecationInterceptor } from './interceptors/legacy-backup-deprecation.interceptor';

@Module({
  imports: [PrismaModule, AuditModule, CronModule, PathsModule, NotificationsModule],
  controllers: [BackupsController, BackupLegacyController, BackupInternalController],
  providers: [
    BackupConfigService,
    BackupProcessService,
    BackupLockService,
    BackupRuntimeStateService,
    BackupService,
    BackupJobRunnerService,
    BackupCronService,
    BackupInternalGuard,
    LegacyBackupDeprecationInterceptor,
    {
      provide: APP_GUARD,
      useClass: BackupMaintenanceGuard,
    },
  ],
  exports: [BackupService, BackupRuntimeStateService],
})
export class BackupModule {}
