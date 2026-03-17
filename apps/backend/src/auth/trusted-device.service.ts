import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { TRUSTED_DEVICE_TTL_MS } from './trusted-device.constants';

type TrustedDeviceActor = {
  userId: string;
  email?: string;
  role?: string;
};

export type TrustedDeviceValidationStatus =
  | 'missing'
  | 'valid'
  | 'not_found'
  | 'user_mismatch'
  | 'expired'
  | 'revoked'
  | 'invalid';

export type TrustedDeviceValidationResult = {
  status: TrustedDeviceValidationStatus;
  shouldBypass2FA: boolean;
  shouldClearCookie: boolean;
  trustedDeviceId?: string;
};

type CreateTrustedDeviceInput = {
  userId: string;
  tenantId?: string | null;
  ipAddress?: string;
  userAgent?: string;
};

type ValidateTrustedDeviceInput = {
  token?: string | null;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};

type RevokeTrustedDevicesInput = {
  userId: string;
  tenantId?: string | null;
  revokedByUserId?: string | null;
  reason: string;
  actor?: TrustedDeviceActor;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class TrustedDeviceService {
  private readonly logger = new Logger(TrustedDeviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuditService))
    private readonly auditService: AuditService,
  ) {}

  async issueTrustedDevice(input: CreateTrustedDeviceInput): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);

    const created = await this.prisma.trustedDevice.create({
      data: {
        userId: input.userId,
        tokenHash,
        deviceLabel: this.buildDeviceLabel(input.userAgent),
        userAgent: this.toNullableString(input.userAgent),
        createdIp: this.toNullableString(input.ipAddress),
        lastUsedIp: this.toNullableString(input.ipAddress),
        lastUsedAt: now,
        expiresAt,
      },
    });

    await this.auditService.log({
      action: 'TRUSTED_DEVICE_CREATED',
      userId: input.userId,
      tenantId: input.tenantId || undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: {
        trustedDeviceId: created.id,
        expiresAt: created.expiresAt.toISOString(),
      },
    });

    return {
      token,
      expiresAt,
    };
  }

  async validateTrustedDevice(input: ValidateTrustedDeviceInput): Promise<TrustedDeviceValidationResult> {
    const token = String(input.token || '').trim();
    if (!token) {
      return {
        status: 'missing',
        shouldBypass2FA: false,
        shouldClearCookie: false,
      };
    }

    try {
      const tokenHash = this.hashToken(token);
      const trustedDevice = await this.prisma.trustedDevice.findUnique({
        where: {
          tokenHash,
        },
      });

      if (!trustedDevice) {
        return {
          status: 'not_found',
          shouldBypass2FA: false,
          shouldClearCookie: true,
        };
      }

      if (trustedDevice.userId !== input.userId) {
        return {
          status: 'user_mismatch',
          shouldBypass2FA: false,
          shouldClearCookie: true,
        };
      }

      if (trustedDevice.revokedAt) {
        return {
          status: 'revoked',
          shouldBypass2FA: false,
          shouldClearCookie: true,
          trustedDeviceId: trustedDevice.id,
        };
      }

      if (trustedDevice.expiresAt.getTime() <= Date.now()) {
        return {
          status: 'expired',
          shouldBypass2FA: false,
          shouldClearCookie: true,
          trustedDeviceId: trustedDevice.id,
        };
      }

      await this.prisma.trustedDevice.update({
        where: { id: trustedDevice.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: this.toNullableString(input.ipAddress) || trustedDevice.lastUsedIp,
        },
      });

      return {
        status: 'valid',
        shouldBypass2FA: true,
        shouldClearCookie: false,
        trustedDeviceId: trustedDevice.id,
      };
    } catch (error) {
      this.logger.error(`trusted_device_validation_failed userId=${input.userId}`, error as Error);
      return {
        status: 'invalid',
        shouldBypass2FA: false,
        shouldClearCookie: true,
      };
    }
  }

  async revokeAllForUser(input: RevokeTrustedDevicesInput): Promise<number> {
    const now = new Date();
    const revokedByUserId = this.toNullableString(input.revokedByUserId);

    const result = await this.prisma.trustedDevice.updateMany({
      where: {
        userId: input.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedByUserId,
        revokeReason: input.reason,
      },
    });

    await this.auditService.log({
      action: 'TRUSTED_DEVICE_REVOKED',
      userId: input.userId,
      tenantId: input.tenantId || undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      actor: input.actor,
      details: {
        reason: input.reason,
        revokedByUserId,
        revokedCount: result.count,
      },
    });

    return result.count;
  }

  async cleanupExpiredTrustedDevices(): Promise<number> {
    const now = new Date();
    const revokedRetentionBoundary = new Date(now.getTime() - TRUSTED_DEVICE_TTL_MS);

    const result = await this.prisma.trustedDevice.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now,
            },
          },
          {
            revokedAt: {
              not: null,
              lt: revokedRetentionBoundary,
            },
          },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`trusted_devices_cleanup removed=${result.count}`);
    }

    return result.count;
  }

  private generateToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    const hashSecret =
      this.configService.get<string>('TRUSTED_DEVICE_TOKEN_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'trusted-device-fallback-secret';

    return crypto.createHmac('sha256', hashSecret).update(token).digest('hex');
  }

  private buildDeviceLabel(userAgent?: string): string | null {
    const ua = String(userAgent || '').trim().toLowerCase();
    if (!ua) {
      return null;
    }

    let browser = 'Browser';
    if (ua.includes('edg/')) {
      browser = 'Edge';
    } else if (ua.includes('chrome/')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox/')) {
      browser = 'Firefox';
    } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
      browser = 'Safari';
    }

    let os = 'Unknown OS';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
      os = 'iOS';
    } else if (ua.includes('mac os') || ua.includes('macintosh')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    }

    return `${browser} / ${os}`;
  }

  private toNullableString(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
