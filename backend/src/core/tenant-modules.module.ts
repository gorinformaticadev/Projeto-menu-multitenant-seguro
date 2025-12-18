import { Module } from '@nestjs/common';
import { TenantModulesController } from './tenant-modules.controller';
import { TenantModuleService } from './modules/engine/backend/tenant-module.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantModulesController],
  providers: [TenantModuleService],
  exports: [TenantModuleService],
})
export class TenantModulesModule {}