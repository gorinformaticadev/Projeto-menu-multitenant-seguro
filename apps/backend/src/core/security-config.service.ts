 import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';

@Injectable()
export class SecurityConfigService {
  constructor(private prisma: PrismaService) {
      // Empty implementation
    }

  /**
   * ObtÃ©m a configuraÃ§Ã£o de seguranÃ§a atual
   * Se nÃ£o existir, cria uma com valores padrÃ£o
   */
  async getConfig() {
    let config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // Criar configuraÃ§Ã£o padrÃ£o
      config = await this.prisma.securityConfig.create({
        data: {
      // Empty implementation
    },
      });
    }

    return config;
  }

  /**
   * Atualiza a configuraÃ§Ã£o de seguranÃ§a
   * Apenas SUPER_ADMIN pode fazer isso
   */
  async updateConfig(dto: UpdateSecurityConfigDto, userId: string) {
    const config = await this.getConfig();
    
    // Criptografar credenciais SMTP se fornecidas
    const updateData: unknown = { ...dto, updatedBy: userId };
    
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
   * ObtÃ©m configuraÃ§Ã£o especÃ­fica de rate limiting para login
   */
  async getLoginRateLimit() {
    const config = await this.getConfig();
    return {
      maxAttempts: config.loginMaxAttempts,
      windowMinutes: config.loginWindowMinutes,
    };
  }

  /**
   * ObtÃ©m configuraÃ§Ã£o de validaÃ§Ã£o de senha
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
   * ObtÃ©m configuraÃ§Ã£o de JWT
   */
  async getJwtConfig() {
    const config = await this.getConfig();
    return {
      accessTokenExpiresIn: config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
    };
  }

  /**
   * ObtÃ©m configuraÃ§Ã£o de 2FA
   */
  async getTwoFactorConfig() {
    const config = await this.getConfig();
    return {
      enabled: config.twoFactorEnabled,
      required: config.twoFactorRequired,
    };
  }

  /**
   * ObtÃ©m credenciais SMTP descriptografadas
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

