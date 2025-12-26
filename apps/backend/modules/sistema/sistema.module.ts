
import { Module } from '@nestjs/common';
import { SistemaCronService } from './cron.service';
import { SistemaConfigController } from './controller';
import { CronModule } from '../../../../apps/backend/src/core/cron/cron.module';
import { PrismaModule } from '../../../../apps/backend/src/core/prisma/prisma.module';

@Module({
    imports: [CronModule, PrismaModule],
    providers: [SistemaCronService],
    controllers: [SistemaConfigController],
})
export class SistemaBackendModule { }
