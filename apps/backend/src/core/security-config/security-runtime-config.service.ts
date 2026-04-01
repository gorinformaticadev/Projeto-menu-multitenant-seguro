import { Injectable, Logger } from '@nestjs/common';
import { SecurityConfig } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

type SecurityConfigRecord = SecurityConfig & {
  updateRateLimitWindowMinutes?: number | null;
};

export type LoginPolicy = {
  maxAttempts: number;
  lockDurationMinutes: number;
  windowMinutes: number;
};

export type GlobalRateLimitPolicy = {
  source: 'security_config';
  enabled: boolean;
  requests: number;
  windowMinutes: number;
  environment: 'production' | 'development' | 'test';
};

export type CriticalActionCategory = 'backup' | 'restore' | 'update';

export type CriticalRateLimitPolicy = {
  source: 'security_config';
  windowMinutes: number;
  backupPerHour: number;
  restorePerHour: number;
  updatePerHour: number;
  updateWindowMinutes: number;
};

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
};

export type TwoFactorPolicy = {
  enabled: boolean;
  required: boolean;
  requiredForAdmins: boolean;
  suggested: boolean;
};

export type TokenPolicy = {
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
};

export type SessionPolicy = {
  timeoutMinutes: number;
  maxActiveSessionsPerUser: number;
  refreshTokenRotation: boolean;
};

@Injectable()
export class SecurityRuntimeConfigService {
  private readonly logger = new Logger(SecurityRuntimeConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSecurityConfig(): Promise<SecurityConfigRecord> {
    let config = (await this.prisma.securityConfig.findFirst()) as SecurityConfigRecord | null;

    if (!config) {
      this.logger.warn(
        'Nenhuma linha em security_config encontrada; criando configuracao padrao segura.',
      );
      config = (await this.prisma.securityConfig.create({
        data: {},
      })) as SecurityConfigRecord;
    }

    return config;
  }

  async getLoginPolicy(): Promise<LoginPolicy> {
    const config = await this.getSecurityConfig();
    return {
      maxAttempts: this.readPositiveInteger(config.loginMaxAttempts, 5),
      lockDurationMinutes: this.readPositiveInteger(config.loginLockDurationMinutes, 30),
      windowMinutes: this.readPositiveInteger(config.loginWindowMinutes, 1),
    };
  }

  async getGlobalRateLimitPolicy(): Promise<GlobalRateLimitPolicy> {
    const config = await this.getSecurityConfig();
    const environment = this.resolveEnvironment();

    return {
      source: 'security_config',
      enabled:
        environment === 'production'
          ? config.rateLimitProdEnabled === true
          : config.rateLimitDevEnabled === true,
      requests: this.readPositiveInteger(config.globalMaxRequests, 10000),
      windowMinutes: this.readPositiveInteger(config.globalWindowMinutes, 1),
      environment,
    };
  }

  async getCriticalRateLimitPolicy(): Promise<CriticalRateLimitPolicy> {
    const config = await this.getSecurityConfig();
    return {
      source: 'security_config',
      windowMinutes: 60,
      backupPerHour: this.readPositiveInteger(config.backupRateLimitPerHour, 5),
      restorePerHour: this.readPositiveInteger(config.restoreRateLimitPerHour, 3),
      updatePerHour: this.readPositiveInteger(config.updateRateLimitPerHour, 5),
      updateWindowMinutes: this.readPositiveInteger(config.updateRateLimitWindowMinutes, 60),
    };
  }

  async getPasswordPolicy(): Promise<PasswordPolicy> {
    const config = await this.getSecurityConfig();
    return {
      minLength: this.readPositiveInteger(config.passwordMinLength, 8),
      requireUppercase: config.passwordRequireUppercase === true,
      requireLowercase: config.passwordRequireLowercase === true,
      requireNumbers: config.passwordRequireNumbers === true,
      requireSpecial: config.passwordRequireSpecial === true,
    };
  }

  async getTwoFactorPolicy(): Promise<TwoFactorPolicy> {
    const config = await this.getSecurityConfig();
    return {
      enabled: config.twoFactorEnabled === true,
      required: config.twoFactorRequired === true,
      requiredForAdmins: config.twoFactorRequiredForAdmins === true,
      suggested: config.twoFactorSuggested !== false,
    };
  }

  async getTokenPolicy(): Promise<TokenPolicy> {
    const config = await this.getSecurityConfig();
    return {
      accessTokenExpiresIn: this.normalizeDurationString(config.accessTokenExpiresIn, '15m'),
      refreshTokenExpiresIn: this.normalizeDurationString(config.refreshTokenExpiresIn, '7d'),
    };
  }

  async getSessionPolicy(): Promise<SessionPolicy> {
    const config = await this.getSecurityConfig();
    return {
      timeoutMinutes: this.readPositiveInteger(config.sessionTimeoutMinutes, 30),
      maxActiveSessionsPerUser: this.readPositiveInteger(config.maxActiveSessionsPerUser, 5),
      refreshTokenRotation: config.refreshTokenRotation !== false,
    };
  }

  private resolveEnvironment(): 'production' | 'development' | 'test' {
    if (process.env.NODE_ENV === 'production') {
      return 'production';
    }

    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }

    return 'development';
  }

  private readPositiveInteger(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }

    return fallback;
  }

  private normalizeDurationString(value: unknown, fallback: string): string {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : fallback;
  }
}
