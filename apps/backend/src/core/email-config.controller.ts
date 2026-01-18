import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { EmailConfigService } from './email-config.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto } from './dto/email-config.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { EmailService } from '../email/email.service';

@SkipThrottle()
@Controller('email-config')
@UseGuards(RolesGuard)
export class EmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly emailService: EmailService,
  ) { }

  /**
   * GET /email-config/providers
   * Obter lista de provedores de email pré-configurados
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Get('providers')
  @Roles(Role.SUPER_ADMIN)
  async getProviders() {
    return this.emailConfigService.getPredefinedProviders();
  }

  /**
   * GET /email-config
   * Obter todas as configurações de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Get()
  @Roles(Role.SUPER_ADMIN)
  async getAllConfigs() {
    return this.emailConfigService.getAllConfigs();
  }

  /**
   * GET /email-config/active
   * Obter configuração de email ativa
   * Público para uso no serviço de email
   */
  @SkipThrottle()
  @Get('active')
  async getActiveConfig() {
    return this.emailConfigService.getActiveConfig();
  }

  /**
   * GET /email-config/smtp-credentials
   * Obter credenciais SMTP do SecurityConfig
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Get('smtp-credentials')
  @Roles(Role.SUPER_ADMIN)
  async getSmtpCredentials() {
    return this.emailConfigService.getSmtpCredentials();
  }

  /**
   * POST /email-config
   * Criar nova configuração de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Post()
  @Roles(Role.SUPER_ADMIN)
  async createConfig(
    @Body() dto: CreateEmailConfigDto,
    @Request() req: any,
  ) {
    return this.emailConfigService.createConfig(dto, req.user.id);
  }

  /**
   * PUT /email-config/:id
   * Atualizar configuração de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEmailConfigDto,
    @Request() req: any,
  ) {
    return this.emailConfigService.updateConfig(id, dto, req.user.id);
  }

  /**
   * PUT /email-config/:id/activate
   * Ativar configuração de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Put(':id/activate')
  @Roles(Role.SUPER_ADMIN)
  async activateConfig(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.emailConfigService.activateConfig(id, req.user.id);
  }

  /**
   * DELETE /email-config/:id
   * Remover configuração de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async deleteConfig(@Param('id') id: string) {
    return this.emailConfigService.deleteConfig(id);
  }

  /**
   * POST /email-config/test
   * Testar configuração de email
   * Apenas SUPER_ADMIN
   */
  @SkipThrottle()
  @Post('test')
  @Roles(Role.SUPER_ADMIN)
  async testConfig(
    @Body('email') email: string,
    @Body('smtpUser') smtpUser: string,
    @Body('smtpPass') smtpPass: string,
    @Request() req: any,
  ) {
    return this.emailConfigService.testConfig(email, smtpUser, smtpPass, req.user, this.emailService);
  }
}
