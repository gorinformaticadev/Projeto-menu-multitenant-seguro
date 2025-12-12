import { Module } from '@nestjs/common';
import { ModuleEngineService } from './module-engine.service';
import { ModuleEngineController } from './module-engine.controller';
import { ModuleRegistrationService } from './module-registration.service';
import { ModuleLoaderService } from './module-loader.service';
import { TenantModuleService } from './tenant-module.service';
import { ModuleGuard } from './module-guard.service';
import { PrismaModule } from '../../../backend/src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModuleEngineController],
  providers: [
    ModuleEngineService,
    ModuleRegistrationService,
    ModuleLoaderService,
    TenantModuleService,
    ModuleGuard
  ],
  exports: [
    ModuleEngineService,
    ModuleRegistrationService,
    ModuleLoaderService,
    TenantModuleService,
    ModuleGuard
  ],
})
export class ModuleEngineModule {}