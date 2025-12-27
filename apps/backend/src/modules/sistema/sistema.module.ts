
import { Module } from '@nestjs/common';
import { SistemaCronService } from './cron.service';
import { SistemaConfigController } from './controller';
import { CronModule } from '@core/cron/cron.module';
import { PrismaModule } from '@core/prisma/prisma.module';

@Module({
    imports: [CronModule, PrismaModule],
    providers: [SistemaCronService],
    controllers: [SistemaConfigController],
})
export class SistemaModule { }
