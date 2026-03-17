import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { getPlatformName } from '@core/common/constants/platform.constants';
import { decryptSensitiveData, encryptSensitiveData } from '@core/common/utils/security.utils';
import { TrustedDeviceService } from './trusted-device.service';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityConfigService: SecurityConfigService,
    private readonly trustedDeviceService: TrustedDeviceService,
  ) {}

  /**
   * Gerar secret para 2FA
   */
  async generateSecret(userId: string) {
    await this.assertTwoFactorGloballyEnabled();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuario nao encontrado');
    }

    if (user.twoFactorEnabled || user.twoFactorSecret) {
      await this.trustedDeviceService.revokeAllForUser({
        userId: user.id,
        tenantId: user.tenantId,
        revokedByUserId: user.id,
        reason: '2fa_secret_rotated',
      });
    }

    const platformName = await getPlatformName();
    const secret = speakeasy.generateSecret({
      name: `${platformName} (${user.email})`,
      issuer: platformName,
    });

    const encryptedSecret = encryptSensitiveData(secret.base32);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptedSecret,
      },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  /**
   * Ativar 2FA apos verificar codigo
   */
  async enable(userId: string, token: string) {
    await this.assertTwoFactorGloballyEnabled();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('Secret nao encontrado');
    }

    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Codigo invalido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    return { message: '2FA ativado com sucesso' };
  }

  /**
   * Desativar 2FA
   */
  async disable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA nao esta ativado');
    }

    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Codigo invalido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await this.trustedDeviceService.revokeAllForUser({
      userId: user.id,
      tenantId: user.tenantId,
      revokedByUserId: user.id,
      reason: '2fa_disabled',
    });

    return { message: '2FA desativado com sucesso' };
  }

  /**
   * Verificar codigo 2FA
   */
  verify(secret: string, token: string): boolean {
    const decryptedSecret = decryptSensitiveData(secret);

    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  private async assertTwoFactorGloballyEnabled(): Promise<void> {
    const policy = await this.securityConfigService.getTwoFactorConfig();
    if (policy.enabled !== true) {
      throw new ForbiddenException('2FA desabilitado globalmente');
    }
  }
}
