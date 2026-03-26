 import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailConfigService } from './email-config.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto } from './dto/email-config.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import {
  EmailProviderInfoResponseDto,
  EmailConfigDetailsResponseDto,
  SmtpCredentialsResponseDto,
  EmailTestResponseDto,
} from './dto/email-config-response.dto';

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
  @ValidateResponse(EmailProviderInfoResponseDto)
  async getProviders(): Promise<EmailProviderInfoResponseDto[]> {
    return this.emailConfigService.getPredefinedProviders() as any;
  }

  /**
   * GET /email-config
   * Obter todas as configurações de email
   * Apenas SUPER_ADMIN
   */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ValidateResponse(EmailConfigDetailsResponseDto)
  async getAllConfigs(): Promise<EmailConfigDetailsResponseDto[]> {
    return this.emailConfigService.getAllConfigs() as any;
  }

  /**
   * GET /email-config/active
   * Obter configuração de email ativa
   * Público para uso no serviço de email
   */
  @Get('active')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ValidateResponse(EmailConfigDetailsResponseDto)
  async getActiveConfig(): Promise<EmailConfigDetailsResponseDto | null> {
    return this.emailConfigService.getActiveConfig() as any;
  }

  /**
   * GET /email-config/smtp-credentials
   * Obter credenciais SMTP do SecurityConfig
   * Apenas SUPER_ADMIN - retorna apenas o username (nunca a senha)
   */
  @Get('smtp-credentials')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(SmtpCredentialsResponseDto)
  async getSmtpCredentials(): Promise<SmtpCredentialsResponseDto> {
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
  @ValidateResponse(EmailConfigDetailsResponseDto)
  async createConfig(
    @Body() dto: CreateEmailConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EmailConfigDetailsResponseDto> {
    return this.emailConfigService.createConfig(dto, req.user.id) as any;
  }

  /**
   * PUT /email-config/:id
   * Atualizar configuração de email
   * Apenas SUPER_ADMIN
   */
  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(EmailConfigDetailsResponseDto)
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEmailConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EmailConfigDetailsResponseDto> {
    return this.emailConfigService.updateConfig(id, dto, req.user.id) as any;
  }

  /**
   * PUT /email-config/:id/activate
   * Ativar configuração de email
   * Apenas SUPER_ADMIN
   */
  @Put(':id/activate')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ValidateResponse(EmailConfigDetailsResponseDto)
  async activateConfig(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<EmailConfigDetailsResponseDto> {
    return this.emailConfigService.activateConfig(id, req.user.id) as any;
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
  @ValidateResponse(EmailTestResponseDto)
  async testConfig(
    @Body() dto: CreateEmailConfigDto,
  ): Promise<EmailTestResponseDto> {
    const result = await this.emailService.testConnection(dto);
    return {
      success: !!result,
      message: result ? 'Conexão estabelecida com sucesso' : 'Falha ao conectar ao servidor SMTP',
    };
  }
}
