
import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

@Global() // Global para ser injetado em qualquer módulo sem re-importar
@Module({
    imports: [ScheduleModule],
    providers: [CronService],
    controllers: [CronController],
    exports: [CronService],
})
export class CronModule {
      // Empty implementation
    }
