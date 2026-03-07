import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BackupModule } from '../backup/backup.module';
import { CommonModule } from '../common/common.module';
import { CronModule } from '../core/cron/cron.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SystemDashboardModule } from '../dashboard/system-dashboard.module';
import { UpdateModule } from '../update/update.module';
import { SystemDiagnosticsController } from './system-diagnostics.controller';
import { SystemDiagnosticsService } from './system-diagnostics.service';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    CronModule,
    AuditModule,
    BackupModule,
    UpdateModule,
    SystemDashboardModule,
  ],
  controllers: [SystemDiagnosticsController],
  providers: [SystemDiagnosticsService],
  exports: [SystemDiagnosticsService],
})
export class SystemDiagnosticsModule {}
