import { Module } from '@nestjs/common';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';
import { UpdateCronService } from './update-cron.service';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { PathsModule } from '@core/common/paths/paths.module';

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
  imports: [PrismaModule, AuditModule, CommonModule, PathsModule],
  controllers: [UpdateController, SystemUpdateController],
  providers: [UpdateService, UpdateCronService, SystemUpdateAdminService],
  exports: [UpdateService, SystemUpdateAdminService],
})
export class UpdateModule {
  // Empty implementation
}
