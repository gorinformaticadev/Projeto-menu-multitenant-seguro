import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { TenantModuleService } from '@core/modules/engine/backend/tenant-module.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('tenants/:tenantId/modules')
@UseGuards(RolesGuard)
export class TenantModulesController {
  constructor(private readonly tenantModuleService: TenantModuleService) { }

  @Get(':moduleName/status')
  @Roles(Role.SUPER_ADMIN)
  async getModuleStatus(
    @Param('tenantId') tenantId: string,
    @Param('moduleName') moduleName: string
  ) {
    const isActive = await this.tenantModuleService.isModuleActiveForTenant(moduleName, tenantId);
    return { moduleName, tenantId, active: isActive };
  }

  @Post(':moduleName/activate')
  @Roles(Role.SUPER_ADMIN)
  async activateModule(
    @Param('tenantId') tenantId: string,
    @Param('moduleName') moduleName: string
  ) {
    await this.tenantModuleService.activateModuleForTenant(moduleName, tenantId);
    return { message: `Módulo ${moduleName} ativado para o tenant ${tenantId}` };
  }

  @Post(':moduleName/deactivate')
  @Roles(Role.SUPER_ADMIN)
  async deactivateModule(
    @Param('tenantId') tenantId: string,
    @Param('moduleName') moduleName: string
  ) {
    await this.tenantModuleService.deactivateModuleForTenant(moduleName, tenantId);
    return { message: `Módulo ${moduleName} desativado para o tenant ${tenantId}` };
  }

  @Get('active')
  @Roles(Role.SUPER_ADMIN)
  async getActiveModules(@Param('tenantId') tenantId: string) {
    const activeModules = await this.tenantModuleService.getActiveModulesForTenant(tenantId);
    return { tenantId, activeModules };
  }
}
