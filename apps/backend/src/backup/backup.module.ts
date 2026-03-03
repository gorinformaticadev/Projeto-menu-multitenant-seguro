import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { BackupConfigService } from './backup-config.service';
import { BackupsController, BackupLegacyController } from './backup.controller';
import { BackupCronService } from './backup-cron.service';
import { BackupJobRunnerService } from './backup-job-runner.service';
import { BackupLockService } from './backup-lock.service';
import { BackupProcessService } from './backup-process.service';
import { BackupRuntimeStateService } from './backup-runtime-state.service';
import { BackupService } from './backup.service';
import { BackupMaintenanceGuard } from './guards/backup-maintenance.guard';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BackupsController, BackupLegacyController],
  providers: [
    BackupConfigService,
    BackupProcessService,
    BackupLockService,
    BackupRuntimeStateService,
    BackupService,
    BackupJobRunnerService,
    BackupCronService,
    {
      provide: APP_GUARD,
      useClass: BackupMaintenanceGuard,
    },
  ],
  exports: [BackupService, BackupRuntimeStateService],
})
export class BackupModule {}
