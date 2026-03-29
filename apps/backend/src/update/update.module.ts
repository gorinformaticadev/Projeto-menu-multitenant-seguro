import { Module } from '@nestjs/common';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';
import { UpdateCronService } from './update-cron.service';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { UpdateExecutionController } from './engine/update-execution.controller';
import { UpdateAgentExecutionService } from './engine/update-agent-execution.service';
import { UpdateCommandRunnerService } from './engine/update-command-runner.service';
import { UpdateExecutionBridgeService } from './engine/update-execution-bridge.service';
import { UpdateExecutionFacadeService } from './engine/update-execution.facade.service';
import { UpdateHttpProbeService } from './engine/update-http-probe.service';
import { UpdateExecutionRepository } from './engine/update-execution.repository';
import { UpdateEngineCapabilitiesService } from './engine/update-engine-capabilities.service';
import { UpdateStateMachineService } from './engine/update-state-machine.service';
import { DockerUpdateRuntimeAdapter } from './engine/runtime/docker-update-runtime.adapter';
import { NativeUpdateRuntimeAdapter } from './engine/runtime/native-update-runtime.adapter';
import { UpdateRuntimeAdapterRegistryService } from './engine/runtime/update-runtime-adapter-registry.service';
import { PrismaModule } from '@core/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { PathsModule } from '@core/common/paths/paths.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronModule } from '@core/cron/cron.module';

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
  imports: [PrismaModule, AuditModule, CommonModule, PathsModule, NotificationsModule, CronModule],
  controllers: [UpdateController, SystemUpdateController, UpdateExecutionController],
  providers: [
    UpdateService,
    UpdateCronService,
    SystemUpdateAdminService,
    UpdateExecutionRepository,
    UpdateStateMachineService,
    UpdateExecutionFacadeService,
    UpdateExecutionBridgeService,
    UpdateCommandRunnerService,
    UpdateHttpProbeService,
    NativeUpdateRuntimeAdapter,
    DockerUpdateRuntimeAdapter,
    UpdateRuntimeAdapterRegistryService,
    UpdateEngineCapabilitiesService,
    UpdateAgentExecutionService,
  ],
  exports: [
    UpdateService,
    SystemUpdateAdminService,
    UpdateExecutionRepository,
    UpdateStateMachineService,
    UpdateExecutionFacadeService,
    UpdateExecutionBridgeService,
    UpdateCommandRunnerService,
    UpdateHttpProbeService,
    UpdateRuntimeAdapterRegistryService,
    UpdateEngineCapabilitiesService,
    UpdateAgentExecutionService,
  ],
})
export class UpdateModule {
  // Empty implementation
}
