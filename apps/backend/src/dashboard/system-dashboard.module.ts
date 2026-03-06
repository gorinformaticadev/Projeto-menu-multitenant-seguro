import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SystemDashboardController } from './system-dashboard.controller';
import { ResponseTimeMetricsService } from './system-response-time-metrics.service';
import { SystemDashboardService } from './system-dashboard.service';

@Module({
  imports: [PrismaModule, CommonModule, MaintenanceModule],
  controllers: [SystemDashboardController],
  providers: [SystemDashboardService, ResponseTimeMetricsService],
  exports: [SystemDashboardService, ResponseTimeMetricsService],
})
export class SystemDashboardModule {}
