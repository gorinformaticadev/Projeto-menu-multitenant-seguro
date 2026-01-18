import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';

@Injectable()
export class SecurityConfigService {
  constructor(private prisma: PrismaService) { }

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

    // Criptografar credenciais SMTP se fornecidas
    const updateData: any = { ...dto, updatedBy: userId };

    if (dto.smtpPassword) {
      updateData.smtpPassword = encryptSensitiveData(dto.smtpPassword);
    }

    if (dto.smtpUsername) {
      updateData.smtpUsername = encryptSensitiveData(dto.smtpUsername);
    }

    return this.prisma.securityConfig.update({
      where: { id: config.id },
      data: updateData,
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
   * Obtém credenciais SMTP descriptografadas
   */
  async getSmtpCredentials() {
    const config = await this.getConfig();

    // Descriptografar credenciais se existirem
    const smtpUsername = config.smtpUsername ? decryptSensitiveData(config.smtpUsername) : null;
    const smtpPassword = config.smtpPassword ? decryptSensitiveData(config.smtpPassword) : null;

    return {
      smtpUsername,
      smtpPassword,
    };
  }
}
