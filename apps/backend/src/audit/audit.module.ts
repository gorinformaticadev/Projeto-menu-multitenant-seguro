import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { RateLimitMetricsService } from '../common/services/rate-limit-metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, RateLimitMetricsService],
  exports: [AuditService, RateLimitMetricsService],
})
export class AuditModule {
  // Empty implementation
}
