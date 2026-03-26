import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SecurityConfigService } from './security-config.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { UpdateWebPushConfigDto } from './dto/update-web-push-config.dto';
import {
  SecurityConfigResponseDto,
  WebPushConfigResponseDto,
  PasswordPolicyResponseDto,
  TwoFactorStatusResponseDto,
  FullSecurityConfigResponseDto,
} from './dto/security-config-response.dto';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
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
  @ValidateResponse(SecurityConfigResponseDto)
  async getConfig(): Promise<SecurityConfigResponseDto> {
    return this.securityConfigService.getConfig() as any;
  }

  /**
   * PUT /security-config
   * Atualizar configurações de segurança
   * Apenas SUPER_ADMIN
   */
  @Put()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(SecurityConfigResponseDto)
  async updateConfig(
    @Body() dto: UpdateSecurityConfigDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<SecurityConfigResponseDto> {
    return this.securityConfigService.updateConfig(dto, req.user.id) as any;
  }

  /**
   * GET /security-config/web-push
   * Obter configuracao de Web Push (sem expor chave privada)
   * Apenas SUPER_ADMIN
   */
  @Get('web-push')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ValidateResponse(WebPushConfigResponseDto)
  async getWebPushConfig(): Promise<WebPushConfigResponseDto> {
    const config = await this.securityConfigService.getWebPushConfig();
    return {
      publicKey: config.webPushPublicKey,
      subject: config.webPushSubject,
    };
  }

  /**
   * PUT /security-config/web-push
   * Atualizar configuracao de Web Push
   * Apenas SUPER_ADMIN
   */
  @Put('web-push')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(SecurityConfigResponseDto)
  async updateWebPushConfig(
    @Body() dto: UpdateWebPushConfigDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<SecurityConfigResponseDto> {
    return this.securityConfigService.updateWebPushConfig(dto, req.user.id) as any;
  }

  /**
   * GET /security-config/password-policy
   * Obter política de senha (público para validação no frontend)
   */
  @Public()
  @Get('password-policy')
  @ValidateResponse(PasswordPolicyResponseDto)
  async getPasswordPolicy(): Promise<PasswordPolicyResponseDto> {
    return this.securityConfigService.getPasswordPolicy() as any;
  }

  /**
   * GET /security-config/2fa-status
   * Verificar se 2FA está habilitado globalmente (público)
   */
  @Public()
  @Get('2fa-status')
  @ValidateResponse(TwoFactorStatusResponseDto)
  async get2FAStatus(): Promise<TwoFactorStatusResponseDto> {
    const config = await this.securityConfigService.getTwoFactorConfig();
    return {
      enabled: config.enabled,
      required: config.required,
      requiredForAdmins: config.requiredForAdmins,
      suggested: config.suggested,
    };
  }

  /**
   * GET /security-config/full
   * Obter configurações de segurança completas (público para validação no frontend)
   */
  @Public()
  @Get('full')
  @ValidateResponse(FullSecurityConfigResponseDto)
  async getFullConfig(): Promise<FullSecurityConfigResponseDto> {
    const config = await this.securityConfigService.getConfig();
    const twoFactorPolicy = await this.securityConfigService.getTwoFactorConfig();
    const passwordPolicy = await this.securityConfigService.getPasswordPolicy();
    const jwtConfig = await this.securityConfigService.getJwtConfig();
    return {
      twoFactorEnabled: twoFactorPolicy.enabled,
      twoFactorRequired: twoFactorPolicy.required,
      twoFactorRequiredForAdmins: twoFactorPolicy.requiredForAdmins,
      twoFactorSuggested: twoFactorPolicy.suggested,
      emailVerificationRequired: config.emailVerificationRequired ?? false,
      emailVerificationLevel: config.emailVerificationLevel ?? 'SOFT',
      passwordMinLength: passwordPolicy.minLength,
      passwordRequireUppercase: passwordPolicy.requireUppercase,
      passwordRequireLowercase: passwordPolicy.requireLowercase,
      passwordRequireNumbers: passwordPolicy.requireNumbers,
      passwordRequireSpecial: passwordPolicy.requireSpecial,
      sessionTimeoutMinutes: jwtConfig.sessionTimeoutMinutes,
    };
  }
}
