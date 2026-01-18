import { Module } from '@nestjs/common';
import { TenantModulesController } from './tenant-modules.controller';

@Module({
  controllers: [TenantModulesController],
})
export class TenantModulesModule {
      // Empty implementation
    }