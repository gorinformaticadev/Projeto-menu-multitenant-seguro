import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SecurityConfigService } from './security-config.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('security-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityConfigController {
  constructor(private readonly securityConfigService: SecurityConfigService) {}

  /**
   * GET /security-config
   * Obter configurações de segurança
   * Apenas SUPER_ADMIN
   */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  async getConfig() {
    return this.securityConfigService.getConfig();
  }

  /**
   * PUT /security-config
   * Atualizar configurações de segurança
   * Apenas SUPER_ADMIN
   */
  @Put()
  @Roles(Role.SUPER_ADMIN)
  async updateConfig(
    @Body() dto: UpdateSecurityConfigDto,
    @Request() req: any,
  ) {
    return this.securityConfigService.updateConfig(dto, req.user.id);
  }

  /**
   * GET /security-config/password-policy
   * Obter política de senha (público para validação no frontend)
   */
  @Get('password-policy')
  async getPasswordPolicy() {
    return this.securityConfigService.getPasswordPolicy();
  }
}
