import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { getPlatformName } from '../common/constants/platform.constants';
import { encryptSensitiveData, decryptSensitiveData } from '../common/utils/security.utils';

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Gerar secret para 2FA
   */
  async generateSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Gerar secret
    const platformName = await getPlatformName();
    const secret = speakeasy.generateSecret({
      name: `${platformName} (${user.email})`,
      issuer: platformName,
    });

    // Criptografar o secret antes de salvar
    const encryptedSecret = encryptSensitiveData(secret.base32);

    // Salvar secret criptografado temporário (não ativado ainda)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptedSecret,
      },
    });

    // Gerar QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  /**
   * Ativar 2FA após verificar código
   */
  async enable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('Secret não encontrado');
    }

    // Descriptografar o secret para verificação
    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    // Verificar token
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2, // Aceita 2 códigos antes/depois (60 segundos de margem)
    });

    if (!isValid) {
      throw new Error('Código inválido');
    }

    // Ativar 2FA
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
      throw new Error('2FA não está ativado');
    }

    // Descriptografar o secret para verificação
    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    // Verificar token antes de desativar
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Código inválido');
    }

    // Desativar 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { message: '2FA desativado com sucesso' };
  }

  /**
   * Verificar código 2FA
   */
  verify(secret: string, token: string): boolean {
    // Descriptografar o secret antes da verificação
    const decryptedSecret = decryptSensitiveData(secret);
    
    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }
}