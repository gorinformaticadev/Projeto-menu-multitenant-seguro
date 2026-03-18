
import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

import { RedisLockService } from '../../common/services/redis-lock.service';

@Global() // Global para ser injetado em qualquer módulo sem re-importar
@Module({
    imports: [ScheduleModule],
    providers: [CronJobHeartbeatService, CronService, RedisLockService],
    controllers: [CronController],
    exports: [CronJobHeartbeatService, CronService, RedisLockService],
})
export class CronModule {
      // Empty implementation
    }
