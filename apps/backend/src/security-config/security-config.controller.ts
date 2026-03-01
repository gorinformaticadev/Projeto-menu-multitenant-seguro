import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SecurityConfigService } from './security-config.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { UpdateWebPushConfigDto } from './dto/update-web-push-config.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Role } from '@prisma/client';

@SkipThrottle()
@Controller('security-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityConfigController {
  constructor(private readonly securityConfigService: SecurityConfigService) {
    // Empty implementation
  }

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
    @Req() req: any,
  ) {
    return this.securityConfigService.updateConfig(dto, req.user.id);
  }

  /**
   * GET /security-config/web-push
   * Obter configuração de Web Push (sem expor chave privada)
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Get('web-push')
  @Roles(Role.SUPER_ADMIN)
  async getWebPushConfig() {
    return this.securityConfigService.getWebPushConfig();
  }

  /**
   * PUT /security-config/web-push
   * Atualizar configuração de Web Push
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Put('web-push')
  @Roles(Role.SUPER_ADMIN)
  async updateWebPushConfig(
    @Body() dto: UpdateWebPushConfigDto,
    @Req() req: any,
  ) {
    return this.securityConfigService.updateWebPushConfig(dto, req.user.id);
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
      passwordMinLength: config.passwordMinLength,
      passwordRequireUppercase: config.passwordRequireUppercase,
      passwordRequireLowercase: config.passwordRequireLowercase,
      passwordRequireNumbers: config.passwordRequireNumbers,
      passwordRequireSpecial: config.passwordRequireSpecial,
    };
  }
}
