import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { UpdateWebPushConfigDto } from './dto/update-web-push-config.dto';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';

@Injectable()
export class SecurityConfigService {
  constructor(private prisma: PrismaService) { }

  /**
   * Obtem a configuracao de seguranca atual
   * Se nao existir, cria uma com valores padrao
   */
  async getConfig() {
    let config = await this.prisma.securityConfig.findFirst();

    if (!config) {
      // Criar configuracao padrao
      config = await this.prisma.securityConfig.create({
        data: {},
      });
    }

    return config;
  }

  /**
   * Atualiza a configuracao de seguranca
   * Apenas SUPER_ADMIN pode fazer isso
   */
  async updateConfig(dto: UpdateSecurityConfigDto, userId: string) {
    const config = await this.getConfig();

    // Criptografar credenciais SMTP se fornecidas
    const updateData: Record<string, unknown> = { ...dto, updatedBy: userId };

    if (dto.smtpPassword) {
      updateData.smtpPassword = encryptSensitiveData(dto.smtpPassword);
    }

    if (dto.smtpUsername) {
      updateData.smtpUsername = encryptSensitiveData(dto.smtpUsername);
    }

    if (dto.webPushPrivateKey !== undefined) {
      const privateKey = this.normalizeString(dto.webPushPrivateKey);
      updateData.webPushPrivateKey = privateKey ? encryptSensitiveData(privateKey) : null;
    }

    if (dto.webPushPublicKey !== undefined) {
      updateData.webPushPublicKey = this.normalizeString(dto.webPushPublicKey);
    }

    if (dto.webPushSubject !== undefined) {
      updateData.webPushSubject =
        this.normalizeString(dto.webPushSubject) || 'mailto:suporte@example.com';
    }

    return this.prisma.securityConfig.update({
      where: { id: config.id },
      data: updateData,
    });
  }

  /**
   * Obtem configuracao especifica de rate limiting para login
   */
  async getLoginRateLimit() {
    const config = await this.getConfig();
    return {
      maxAttempts: config.loginMaxAttempts,
      lockDurationMinutes: config.loginLockDurationMinutes,
      windowMinutes: config.loginWindowMinutes,
    };
  }

  /**
   * Obtem configuracao de validacao de senha
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
   * Obtem configuracao de JWT
   */
  async getJwtConfig() {
    const config = await this.getConfig();
    return {
      accessTokenExpiresIn: config.accessTokenExpiresIn,
      refreshTokenExpiresIn: config.refreshTokenExpiresIn,
      sessionTimeoutMinutes: config.sessionTimeoutMinutes,
    };
  }

  /**
   * Obtem configuracao de 2FA
   */
  async getTwoFactorConfig() {
    const config = await this.getConfig();
    return {
      enabled: config.twoFactorEnabled,
      required: config.twoFactorRequired,
      requiredForAdmins: config.twoFactorRequiredForAdmins,
      suggested: config.twoFactorSuggested,
    };
  }

  /**
   * Obtem credenciais SMTP descriptografadas
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
   * Obtem configuracao de Web Push para painel administrativo
   */
  async getWebPushConfig() {
    const config = await this.getConfig();

    return {
      webPushPublicKey: this.normalizeString(config.webPushPublicKey),
      webPushSubject:
        this.normalizeString(config.webPushSubject) || 'mailto:suporte@example.com',
      hasPrivateKey: !!this.normalizeString(config.webPushPrivateKey),
    };
  }

  /**
   * Atualiza configuracao de Web Push
   */
  async updateWebPushConfig(dto: UpdateWebPushConfigDto, userId: string) {
    const config = await this.getConfig();
    const updateData: Record<string, unknown> = { updatedBy: userId };

    if (dto.webPushPublicKey !== undefined) {
      updateData.webPushPublicKey = this.normalizeString(dto.webPushPublicKey);
    }

    if (dto.webPushSubject !== undefined) {
      updateData.webPushSubject =
        this.normalizeString(dto.webPushSubject) || 'mailto:suporte@example.com';
    }

    if (dto.clearPrivateKey) {
      updateData.webPushPrivateKey = null;
    }

    if (dto.webPushPrivateKey !== undefined) {
      const privateKey = this.normalizeString(dto.webPushPrivateKey);
      updateData.webPushPrivateKey = privateKey ? encryptSensitiveData(privateKey) : null;
    }

    await this.prisma.securityConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    return this.getWebPushConfig();
  }

  /**
   * Obtem configuracao de rate limiting adaptativo por ambiente
   */
  async getRateLimitConfig() {
    const config = await this.getConfig();
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      enabled: isProduction ? config.rateLimitProdEnabled : config.rateLimitDevEnabled,
      requests: isProduction ? config.rateLimitProdRequests : config.rateLimitDevRequests,
      window: isProduction ? config.rateLimitProdWindow : config.rateLimitDevWindow,
      isProduction,
    };
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}
