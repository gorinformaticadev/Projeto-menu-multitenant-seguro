
import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { ExecutionLeaseService } from './execution-lease.service';
import { MaterializedCronExecutionService } from './materialized-cron-execution.service';

import { RedisLockService } from '../../common/services/redis-lock.service';

@Global() // Global para ser injetado em qualquer módulo sem re-importar
@Module({
    imports: [ScheduleModule],
    providers: [CronJobHeartbeatService, ExecutionLeaseService, MaterializedCronExecutionService, CronService, RedisLockService],
    controllers: [CronController],
    exports: [CronJobHeartbeatService, ExecutionLeaseService, MaterializedCronExecutionService, CronService, RedisLockService],
})
export class CronModule {
      // Empty implementation
    }
