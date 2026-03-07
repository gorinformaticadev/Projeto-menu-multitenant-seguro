
import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobHeartbeatService } from './cron-job-heartbeat.service';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

@Global() // Global para ser injetado em qualquer módulo sem re-importar
@Module({
    imports: [ScheduleModule],
    providers: [CronJobHeartbeatService, CronService],
    controllers: [CronController],
    exports: [CronJobHeartbeatService, CronService],
})
export class CronModule {
      // Empty implementation
    }
