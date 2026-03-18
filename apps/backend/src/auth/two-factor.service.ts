import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { getPlatformName } from '@core/common/constants/platform.constants';
import { decryptSensitiveData, encryptSensitiveData } from '@core/common/utils/security.utils';
import { TrustedDeviceService } from './trusted-device.service';
import { AuditService } from '../audit/audit.service';

type TwoFactorAuditContext = {
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  auditAction?: string;
};

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityConfigService: SecurityConfigService,
    private readonly trustedDeviceService: TrustedDeviceService,
    @Inject(forwardRef(() => AuditService))
    private readonly auditService: AuditService,
  ) {}

  /**
   * Gerar secret pendente para 2FA.
   * O secret ativo so e trocado quando a verificacao for concluida com sucesso.
   */
  async generateSecret(userId: string, auditContext?: TwoFactorAuditContext) {
    await this.assertTwoFactorGloballyEnabled();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
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
        twoFactorPendingSecret: encryptedSecret,
      },
    });

    await this.auditService.log({
      action: auditContext?.auditAction || 'TWO_FACTOR_SECRET_GENERATED',
      userId: user.id,
      tenantId: user.tenantId || undefined,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      actor: auditContext?.actorUserId
        ? {
            userId: auditContext.actorUserId,
            email: auditContext.actorEmail,
            role: auditContext.actorRole,
          }
        : undefined,
      details: {
        hadActiveTwoFactor: user.twoFactorEnabled === true,
        rotatedSecret: user.twoFactorEnabled === true,
      },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  /**
   * Ativar 2FA apos verificar codigo.
   * Se houver secret pendente, ele vira o secret ativo somente apos a verificacao.
   */
  async enable(userId: string, token: string, auditContext?: TwoFactorAuditContext) {
    await this.assertTwoFactorGloballyEnabled();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const secretToActivate = user.twoFactorPendingSecret || user.twoFactorSecret;
    if (!secretToActivate) {
      throw new NotFoundException('Secret 2FA nao encontrado');
    }

    const decryptedSecret = decryptSensitiveData(secretToActivate);
    this.assertValidToken(decryptedSecret, token);

    const rotatedSecret =
      user.twoFactorEnabled === true &&
      !!user.twoFactorPendingSecret &&
      user.twoFactorPendingSecret !== user.twoFactorSecret;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secretToActivate,
        twoFactorPendingSecret: null,
      },
    });

    if (rotatedSecret) {
      await this.trustedDeviceService.revokeAllForUser({
        userId: user.id,
        tenantId: user.tenantId,
        revokedByUserId: auditContext?.actorUserId || user.id,
        reason: '2fa_secret_rotated',
        actor: auditContext?.actorUserId
          ? {
              userId: auditContext.actorUserId,
              email: auditContext.actorEmail,
              role: auditContext.actorRole,
            }
          : undefined,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
      });
    }

    await this.auditService.log({
      action: auditContext?.auditAction || 'TWO_FACTOR_ENABLED',
      userId: user.id,
      tenantId: user.tenantId || undefined,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      actor: auditContext?.actorUserId
        ? {
            userId: auditContext.actorUserId,
            email: auditContext.actorEmail,
            role: auditContext.actorRole,
          }
        : undefined,
      details: {
        rotatedSecret,
        usedPendingSecret: !!user.twoFactorPendingSecret,
      },
    });

    return { message: '2FA ativado com sucesso' };
  }

  /**
   * Desativar 2FA.
   */
  async disable(userId: string, token: string, auditContext?: TwoFactorAuditContext) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new NotFoundException('2FA nao esta ativado');
    }

    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);
    this.assertValidToken(decryptedSecret, token);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
      },
    });

    await this.trustedDeviceService.revokeAllForUser({
      userId: user.id,
      tenantId: user.tenantId,
      revokedByUserId: auditContext?.actorUserId || user.id,
      reason: '2fa_disabled',
      actor: auditContext?.actorUserId
        ? {
            userId: auditContext.actorUserId,
            email: auditContext.actorEmail,
            role: auditContext.actorRole,
          }
        : undefined,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    });

    await this.auditService.log({
      action: auditContext?.auditAction || 'TWO_FACTOR_DISABLED',
      userId: user.id,
      tenantId: user.tenantId || undefined,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      actor: auditContext?.actorUserId
        ? {
            userId: auditContext.actorUserId,
            email: auditContext.actorEmail,
            role: auditContext.actorRole,
          }
        : undefined,
      details: {
        trustedDevicesRevoked: true,
      },
    });

    return { message: '2FA desativado com sucesso' };
  }

  /**
   * Verificar codigo 2FA.
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

  private assertValidToken(secret: string, token: string): void {
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new BadRequestException('Codigo invalido');
    }
  }
}
