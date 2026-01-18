 import { Module } from '@nestjs/common';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';
import { UpdateCronService } from './update-cron.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

/**
 * MÃ³dulo do Sistema de AtualizaÃ§Ãµes
 * 
 * Funcionalidades:
 * - VerificaÃ§Ã£o automÃ¡tica de novas versÃµes via Git
 * - ExecuÃ§Ã£o segura de atualizaÃ§Ãµes com backup
 * - Rollback automÃ¡tico em caso de falhas
 * - Auditoria completa de todas as operaÃ§Ãµes
 * - Interface REST para administradores
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UpdateController],
  providers: [UpdateService, UpdateCronService],
  exports: [UpdateService],
})
export class UpdateModule {
      // Empty implementation
    }
