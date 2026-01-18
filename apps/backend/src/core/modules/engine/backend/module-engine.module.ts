import { Module } from '@nestjs/common';
import { TenantModuleService } from './tenant-module.service';

@Module({
    providers: [TenantModuleService],
    exports: [TenantModuleService],
})
export class ModuleEngineModule {
      // Empty implementation
    }
