import { Module } from '@nestjs/common';
import { SistemaConfigController } from './controller';
import { SistemaCronService } from './cron.service';

@Module({
    controllers: [SistemaConfigController],
    providers: [SistemaCronService],
})
export class SistemaModule { }
