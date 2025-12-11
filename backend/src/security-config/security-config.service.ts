import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';

@Injectable()
export class SecurityConfigService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtém a configuração de segurança atual
   * Se não existir, cria uma com valores padrão
   */
  async getConfig() {
    let config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // Criar configuração padrão
      config = await this.prisma.securityConfig.create({
        data: {},
      });
    }

    return config;
  }

  /**
   * Atualiza a configuração de segurança
   * Apenas SUPER_ADMIN pode fazer isso
   */
  async updateConfig(dto: UpdateSecurityConfigDto, userId: string) {
    const config = await this.getConfig();

    return this.prisma.securityConfig.update({
      where: { id: config.id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  /**
   * Obtém configuração específica de rate limiting para login
   */
  async getLoginRateLimit() {
    const config = await this.getConfig();
    return {
      maxAttempts: config.loginMaxAttempts,
      windowMinutes: config.loginWindowMinutes,
    };
  }

  /**
   * Obtém configuração de validação de senha
   */
  async getPasswordPolicy() {
    const config = await this.getConfig();
    return {
      minLength: config.passwordMinLength,
      requireUppercase: config.passwordRequireUppercase,
      requireLowercase: config.passwordRequireLowercase,
      requireNumbers: config.passwordRequireNumbers,
      requireSpecial: config.passwordRequireSpecial,
    };
  }

  /**
   * Obtém configuração de JWT
   */
  async getJwtConfig() {
    const config = await this.getConfig();
    return {
      accessTokenExpiresIn: config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
    };
  }

  /**
   * Obtém configuração de 2FA
   */
  async getTwoFactorConfig() {
    const config = await this.getConfig();
    return {
      enabled: config.twoFactorEnabled,
      required: config.twoFactorRequired,
    };
  }

  /**
   * Obtém credenciais SMTP
   */
  async getSmtpCredentials() {
    const config = await this.getConfig();
    return {
      smtpUsername: config.smtpUsername,
      smtpPassword: config.smtpPassword,
    };
  }
}