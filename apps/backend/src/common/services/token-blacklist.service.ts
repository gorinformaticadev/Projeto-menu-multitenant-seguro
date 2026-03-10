import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private blacklist = new Set<string>();

  constructor(private prisma: PrismaService) {}

  async blacklistToken(token: string, expiry: Date, userId?: string): Promise<void> {
    this.blacklist.add(token);

    try {
      await this.prisma.blacklistedToken.create({
        data: {
          token,
          expiresAt: expiry,
          userId,
        },
      });
    } catch (error) {
      this.logger.error('Falha ao armazenar token blacklistado no banco', error as Error);
    }

    const ttl = expiry.getTime() - Date.now();
    if (ttl > 0) {
      setTimeout(() => {
        this.blacklist.delete(token);
        void this.cleanupExpiredTokens();
      }, ttl);
    }

    this.logger.log(`Token revogado para usuario ${userId ?? 'unknown'} ate ${expiry.toISOString()}`);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (this.blacklist.has(token)) {
      return true;
    }

    try {
      const blacklistedToken = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });

      if (blacklistedToken) {
        this.blacklist.add(token);
        return true;
      }
    } catch (error) {
      this.logger.error('Erro ao verificar token blacklistado', error as Error);
    }

    return false;
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.prisma.blacklistedToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      this.logger.log(`Removidos ${result.count} tokens expirados da blacklist`);
    } catch (error) {
      this.logger.error('Erro ao limpar tokens expirados', error as Error);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const refreshTokens = await this.prisma.refreshToken.findMany({
        where: { userId },
      });

      for (const refreshToken of refreshTokens) {
        await this.blacklistToken(refreshToken.token, refreshToken.expiresAt, userId);
      }

      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({
          where: { userId },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            sessionVersion: {
              increment: 1,
            },
          } as any,
        }),
      ]);

      this.logger.log(`Revogados todos os tokens do usuario ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao revogar tokens do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  async clearBlacklist(): Promise<void> {
    this.blacklist.clear();

    try {
      await this.prisma.blacklistedToken.deleteMany({});
      this.logger.log('Blacklist completamente limpa');
    } catch (error) {
      this.logger.error('Erro ao limpar blacklist', error as Error);
      throw error;
    }
  }
}
