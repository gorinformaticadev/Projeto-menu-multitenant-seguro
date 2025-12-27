import { Module } from '@nestjs/common';
import { SistemaController } from './sistema.controller';
import { SistemaService } from './sistema.service';
import { SistemaCronService } from './cron.service';

@Module({
    controllers: [SistemaController],
    providers: [SistemaService, SistemaCronService],
})
export class SistemaModule { }
