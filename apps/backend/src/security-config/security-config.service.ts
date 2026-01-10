import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';

@Injectable()
export class SecurityConfigService {
  constructor(private prisma: PrismaService) {}

  /**
   * ObtÃ©m a configuraÃ§Ã£o de seguranÃ§a atual
   * Se nÃ£o existir, cria uma com valores padrÃ£o
   */
  async getConfig() {
    let config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // Criar configuraÃ§Ã£o padrÃ£o
      config = await this.prisma.securityConfig.create({
        data: {},
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

  /**
   * Obtém configuração de rate limiting adaptativo por ambiente
   */
  async getRateLimitConfig() {
    const config = await this.getConfig();
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      enabled: isProduction ? config.rateLimitProdEnabled : config.rateLimitDevEnabled,
      requests: isProduction ? config.rateLimitProdRequests : config.rateLimitDevRequests,
      window: isProduction ? config.rateLimitProdWindow : config.rateLimitDevWindow,
      isProduction
    };
  }

  /**
   * Obtém configuração de tokens e sessões
   */
  async getTokenSessionConfig() {
    const config = await this.getConfig();
    
    return {
      tokenCleanupEnabled: config.tokenCleanupEnabled,
      tokenCleanupIntervalHours: config.tokenCleanupIntervalHours,
      maxActiveSessionsPerUser: config.maxActiveSessionsPerUser,
      refreshTokenRotation: config.refreshTokenRotation,
      sessionTimeoutMinutes: config.sessionTimeoutMinutes
    };
  }

  /**
   * Obtém todas as configurações de segurança em um objeto único
   */
  async getFullConfig() {
    const config = await this.getConfig();
    
    return {
      // Rate Limiting
      rateLimit: {
        login: {
          maxAttempts: config.loginMaxAttempts,
          lockDurationMinutes: config.loginLockDurationMinutes,
          windowMinutes: config.loginWindowMinutes
        },
        global: {
          maxRequests: config.globalMaxRequests,
          windowMinutes: config.globalWindowMinutes
        },
        adaptive: await this.getRateLimitConfig()
      },
      
      // Password Policy
      password: {
        minLength: config.passwordMinLength,
        requireUppercase: config.passwordRequireUppercase,
        requireLowercase: config.passwordRequireLowercase,
        requireNumbers: config.passwordRequireNumbers,
        requireSpecial: config.passwordRequireSpecial,
        reuseLimit: config.passwordReuseLimit
      },
      
      // JWT & Sessions
      tokens: {
        accessTokenExpiresIn: config.accessTokenExpiresIn,
        refreshTokenExpiresIn: config.refreshTokenExpiresIn,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        ...await this.getTokenSessionConfig()
      },
      
      // 2FA
      twoFactor: {
        enabled: config.twoFactorEnabled,
        required: config.twoFactorRequired,
        requiredForAdmins: config.twoFactorRequiredForAdmins,
        suggested: config.twoFactorSuggested
      },
      
      // Email
      email: {
        verificationRequired: config.emailVerificationRequired,
        verificationLevel: config.emailVerificationLevel
      },
      
      // Platform
      platform: {
        name: config.platformName,
        email: config.platformEmail,
        phone: config.platformPhone
      }
    };
  }
}

