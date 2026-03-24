 import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailConfigService } from './email-config.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto } from './dto/email-config.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { EmailService } from '../email/email.service';

type AuthenticatedRequest = { user: { id: string; [key: string]: unknown } };

@Controller('email-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly emailService: EmailService,
  ) {
      // Empty implementation
    }

  /**
   * GET /email-config/providers
   * Obter lista de provedores de email pré-configurados
   * Apenas SUPER_ADMIN
   */
  @Get('providers')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getProviders() {
    return this.emailConfigService.getPredefinedProviders();
  }

  /**
   * GET /email-config
   * Obter todas as configurações de email
   * Apenas SUPER_ADMIN
   */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getAllConfigs() {
    return this.emailConfigService.getAllConfigs();
  }

  /**
   * GET /email-config/active
   * Obter configuração de email ativa
   * Público para uso no serviço de email
   */
  @Get('active')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getActiveConfig() {
    return this.emailConfigService.getActiveConfig();
  }

  /**
   * GET /email-config/smtp-credentials
   * Obter credenciais SMTP do SecurityConfig
   * Apenas SUPER_ADMIN - retorna apenas o username (nunca a senha)
   */
  @Get('smtp-credentials')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getSmtpCredentials() {
    const credentials = await this.emailConfigService.getSmtpCredentials();
    return {
      smtpUsername: credentials.smtpUsername || null,
      hasPassword: !!credentials.smtpPassword,
    };
  }

  /**
   * POST /email-config
   * Criar nova configuração de email
   * Apenas SUPER_ADMIN
   */
  @Post()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createConfig(
    @Body() dto: CreateEmailConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.emailConfigService.createConfig(dto, req.user.id);
  }

  /**
   * PUT /email-config/:id
   * Atualizar configuração de email
   * Apenas SUPER_ADMIN
   */
  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEmailConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.emailConfigService.updateConfig(id, dto, req.user.id);
  }

  /**
   * PUT /email-config/:id/activate
   * Ativar configuração de email
   * Apenas SUPER_ADMIN
   */
  @Put(':id/activate')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async activateConfig(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.emailConfigService.activateConfig(id, req.user.id);
  }

  /**
   * DELETE /email-config/:id
   * Remover configuração de email
   * Apenas SUPER_ADMIN
   */
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async deleteConfig(@Param('id') id: string) {
    return this.emailConfigService.deleteConfig(id);
  }

  /**
   * POST /email-config/test
   * Testar configuração de email
   * Apenas SUPER_ADMIN
   */
  @Post('test')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async testConfig(
    @Body('email') email: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.emailConfigService.testConfig(email, req.user, this.emailService);
  }
}
