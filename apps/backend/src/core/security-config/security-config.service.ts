import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { UpdateSecurityConfigDto } from './dto/update-security-config.dto';
import { UpdateWebPushConfigDto } from './dto/update-web-push-config.dto';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';
import { SecurityRuntimeConfigService } from './security-runtime-config.service';

@Injectable()
export class SecurityConfigService {
  constructor(
    private prisma: PrismaService,
    private readonly runtimeConfigService: SecurityRuntimeConfigService,
  ) {}

  /**
   * Obtem a configuracao de seguranca atual
   * Se nao existir, cria uma com valores padrao
   */
  async getConfig() {
    return this.runtimeConfigService.getSecurityConfig();
  }

  /**
   * Atualiza a configuracao de seguranca
   * Apenas SUPER_ADMIN pode fazer isso
   */
  async updateConfig(dto: UpdateSecurityConfigDto, userId: string) {
    const config = await this.getConfig();

    // Criptografar credenciais SMTP se fornecidas
    const updateData: Record<string, unknown> = { ...dto, updatedBy: userId };

    if (dto.globalMaxRequests !== undefined) {
      updateData.rateLimitDevRequests = dto.globalMaxRequests;
      updateData.rateLimitProdRequests = dto.globalMaxRequests;
    }

    if (dto.globalWindowMinutes !== undefined) {
      updateData.rateLimitDevWindow = dto.globalWindowMinutes;
      updateData.rateLimitProdWindow = dto.globalWindowMinutes;
    }

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
    return this.runtimeConfigService.getLoginPolicy();
  }

  /**
   * Obtem configuracao de validacao de senha
   */
  async getPasswordPolicy() {
    return this.runtimeConfigService.getPasswordPolicy();
  }

  /**
   * Obtem configuracao de JWT
   */
  async getJwtConfig() {
    const tokenPolicy = await this.runtimeConfigService.getTokenPolicy();
    const sessionPolicy = await this.runtimeConfigService.getSessionPolicy();
    return {
      accessTokenExpiresIn: tokenPolicy.accessTokenExpiresIn,
      refreshTokenExpiresIn: tokenPolicy.refreshTokenExpiresIn,
      sessionTimeoutMinutes: sessionPolicy.timeoutMinutes,
    };
  }

  /**
   * Obtem configuracao de 2FA
   */
  async getTwoFactorConfig() {
    return this.runtimeConfigService.getTwoFactorPolicy();
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
    const policy = await this.runtimeConfigService.getGlobalRateLimitPolicy();
    return {
      enabled: policy.enabled,
      requests: policy.requests,
      window: policy.windowMinutes,
      isProduction: policy.environment === 'production',
      source: policy.source,
    };
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}
