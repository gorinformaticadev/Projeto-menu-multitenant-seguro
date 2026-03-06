import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CronModule } from '../core/cron/cron.module';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SystemDataRetentionController } from './system-data-retention.controller';
import { SystemDataRetentionService } from './system-data-retention.service';

@Module({
  imports: [PrismaModule, CronModule, AuditModule],
  controllers: [SystemDataRetentionController],
  providers: [SystemDataRetentionService],
  exports: [SystemDataRetentionService],
})
export class SystemDataRetentionModule {}
