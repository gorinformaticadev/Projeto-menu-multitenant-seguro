import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../core/prisma/prisma.module';
import { PathsModule } from '../core/common/paths/paths.module';
import { TokenCleanupService } from '../common/services/token-cleanup.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MaintenanceModeService } from './maintenance-mode.service';
import { MaintenanceModeGuard } from './maintenance-mode.guard';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [JwtModule.register({}), PrismaModule, PathsModule, AuditModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [TokenCleanupService, MaintenanceModeService, MaintenanceModeGuard],
  exports: [TokenCleanupService, MaintenanceModeService, MaintenanceModeGuard],
})
export class MaintenanceModule {}
