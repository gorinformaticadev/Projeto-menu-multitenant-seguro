import { Module } from '@nestjs/common';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';
import { UpdateCronService } from './update-cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Módulo do Sistema de Atualizações
 * 
 * Funcionalidades:
 * - Verificação automática de novas versões via Git
 * - Execução segura de atualizações com backup
 * - Rollback automático em caso de falhas
 * - Auditoria completa de todas as operações
 * - Interface REST para administradores
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UpdateController],
  providers: [UpdateService, UpdateCronService],
  exports: [UpdateService],
})
export class UpdateModule {}