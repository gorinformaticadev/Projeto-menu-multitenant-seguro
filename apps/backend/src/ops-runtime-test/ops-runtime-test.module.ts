import { Module } from '@nestjs/common';
import { CommonModule } from '@common/common.module';
import { CronModule } from '@core/cron/cron.module';
import { OpsRuntimeTestController } from './ops-runtime-test.controller';
import { OpsRuntimeTestService } from './ops-runtime-test.service';

@Module({
  imports: [CommonModule, CronModule],
  controllers: [OpsRuntimeTestController],
  providers: [OpsRuntimeTestService],
})
export class OpsRuntimeTestModule {}
