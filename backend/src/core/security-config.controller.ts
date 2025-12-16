import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SecurityConfigService } from './security-config.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '@prisma/client';

@SkipThrottle()
@Controller('security-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityConfigController {
  constructor(private readonly securityConfigService: SecurityConfigService) {}

  /**
   * GET /security-config
   * Obter configurações de segurança
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
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
  @SkipThrottle()
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
  @Public()
  @SkipThrottle()
  @Get('password-policy')
  async getPasswordPolicy() {
    return this.securityConfigService.getPasswordPolicy();
  }

  /**
   * GET /security-config/2fa-status
   * Verificar se 2FA está habilitado globalmente (público)
   */
  @Public()
  @SkipThrottle()
  @Get('2fa-status')
  async get2FAStatus() {
    const config = await this.securityConfigService.getConfig();
    return {
      enabled: config.twoFactorEnabled,
      required: config.twoFactorRequired,
    };
  }

  /**
   * GET /security-config/full
   * Obter configurações de segurança completas (público para validação no frontend)
   */
  @Public()
  @SkipThrottle()
  @Get('full')
  async getFullConfig() {
    const config = await this.securityConfigService.getConfig();
    return {
      twoFactorEnabled: config.twoFactorEnabled,
      twoFactorRequired: config.twoFactorRequired,
      twoFactorSuggested: config.twoFactorSuggested || true,
      emailVerificationRequired: config.emailVerificationRequired || false,
      emailVerificationLevel: config.emailVerificationLevel || 'SOFT',
    };
  }
}
