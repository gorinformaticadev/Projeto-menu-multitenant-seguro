import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ModuleEngineService } from './module-engine.service';
import { JwtAuthGuard } from '../../../backend/src/common/guards/jwt-auth.guard';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModuleEngineController {
  constructor(private readonly moduleEngineService: ModuleEngineService) {}

  /**
   * Retorna a lista de módulos disponíveis
   */
  @Get()
  getAvailableModules() {
    return this.moduleEngineService.getAvailableModules();
  }

  /**
   * Retorna a configuração de um módulo específico
   */
  @Get(':moduleName/config')
  getModuleConfig(@Param('moduleName') moduleName: string) {
    return this.moduleEngineService.getModuleConfig(moduleName);
  }

  /**
   * Verifica se um módulo está ativo para um tenant específico
   */
  @Get(':moduleName/status')
  async isModuleActive(
    @Param('moduleName') moduleName: string,
    @Query('tenantId') tenantId: string
  ) {
    const isActive = await this.moduleEngineService.isModuleActiveForTenant(moduleName, tenantId);
    return { moduleName, tenantId, active: isActive };
  }
}