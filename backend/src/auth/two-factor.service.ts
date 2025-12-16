import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { getPlatformName } from '@core/common/constants/platform.constants';
import { encryptSensitiveData, decryptSensitiveData } from '@core/common/utils/security.utils';

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
      throw new Error('UsuÃ¡rio nÃ£o encontrado');
    }

    // Gerar secret
    const platformName = await getPlatformName();
    const secret = speakeasy.generateSecret({
      name: `${platformName} (${user.email})`,
      issuer: platformName,
    });

    // Criptografar o secret antes de salvar
    const encryptedSecret = encryptSensitiveData(secret.base32);

    // Salvar secret criptografado temporÃ¡rio (nÃ£o ativado ainda)
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
   * Ativar 2FA apÃ³s verificar cÃ³digo
   */
  async enable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('Secret nÃ£o encontrado');
    }

    // Descriptografar o secret para verificaÃ§Ã£o
    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    // Verificar token
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2, // Aceita 2 cÃ³digos antes/depois (60 segundos de margem)
    });

    if (!isValid) {
      throw new Error('CÃ³digo invÃ¡lido');
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
      throw new Error('2FA nÃ£o estÃ¡ ativado');
    }

    // Descriptografar o secret para verificaÃ§Ã£o
    const decryptedSecret = decryptSensitiveData(user.twoFactorSecret);

    // Verificar token antes de desativar
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('CÃ³digo invÃ¡lido');
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
   * Verificar cÃ³digo 2FA
   */
  verify(secret: string, token: string): boolean {
    // Descriptografar o secret antes da verificaÃ§Ã£o
    const decryptedSecret = decryptSensitiveData(secret);
    
    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }
}

