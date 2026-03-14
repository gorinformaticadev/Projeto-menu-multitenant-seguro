import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SecurityConfigService } from './security-config.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { UpdateWebPushConfigDto } from './dto/update-web-push-config.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Role } from '@prisma/client';

type AuthenticatedRequest = { user: { id: string; [key: string]: unknown } };

@Controller('security-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityConfigController {
  constructor(private readonly securityConfigService: SecurityConfigService) { }

  /**
   * GET /security-config
   * Obter configurações de segurança
   * Apenas SUPER_ADMIN
   */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateConfig(
    @Body() dto: UpdateSecurityConfigDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.securityConfigService.updateConfig(dto, req.user.id);
  }

  /**
   * GET /security-config/web-push
   * Obter configuracao de Web Push (sem expor chave privada)
   * Apenas SUPER_ADMIN
   */
  @Get('web-push')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getWebPushConfig() {
    return this.securityConfigService.getWebPushConfig();
  }

  /**
   * PUT /security-config/web-push
   * Atualizar configuracao de Web Push
   * Apenas SUPER_ADMIN
   */
  @Put('web-push')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateWebPushConfig(
    @Body() dto: UpdateWebPushConfigDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.securityConfigService.updateWebPushConfig(dto, req.user.id);
  }

  /**
   * GET /security-config/password-policy
   * Obter política de senha (público para validação no frontend)
   */
  @Public()
  @Get('password-policy')
  async getPasswordPolicy() {
    return this.securityConfigService.getPasswordPolicy();
  }

  /**
   * GET /security-config/2fa-status
   * Verificar se 2FA está habilitado globalmente (público)
   */
  @Public()
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
  @Get('full')
  async getFullConfig() {
    const config = await this.securityConfigService.getConfig();
    return {
      twoFactorEnabled: config.twoFactorEnabled,
      twoFactorRequired: config.twoFactorRequired,
      twoFactorRequiredForAdmins: config.twoFactorRequiredForAdmins,
      twoFactorSuggested: config.twoFactorSuggested ?? true,
      emailVerificationRequired: config.emailVerificationRequired ?? false,
      emailVerificationLevel: config.emailVerificationLevel ?? 'SOFT',
      passwordMinLength: config.passwordMinLength,
      passwordRequireUppercase: config.passwordRequireUppercase,
      passwordRequireLowercase: config.passwordRequireLowercase,
      passwordRequireNumbers: config.passwordRequireNumbers,
      passwordRequireSpecial: config.passwordRequireSpecial,
      sessionTimeoutMinutes: config.sessionTimeoutMinutes,
    };
  }
}
