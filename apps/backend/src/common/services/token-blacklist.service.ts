import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private blacklist = new Set<string>(); // Em produção: usar Redis

  constructor(private prisma: PrismaService) { }

  /**
   * Adiciona um token à blacklist
   */
  async blacklistToken(token: string, expiry: Date, userId?: string): Promise<void> {
    // Armazenar na memória (temporário)
    this.blacklist.add(token);

    // Armazenar no banco para persistência
    try {
      await this.prisma.blacklistedToken.create({
        data: {
          token,
          expiresAt: expiry,
          userId,
        },
      });
    } catch (error) {
      this.logger.error('Falha ao armazenar token blacklistado no banco', error);
    }

    // Limpar token expirado automaticamente
    const ttl = expiry.getTime() - Date.now();
    if (ttl > 0) {
      setTimeout(() => {
        this.blacklist.delete(token);
        this.cleanupExpiredTokens();
      }, ttl);
    }

    this.logger.log(`Token adicionado à blacklist para usuário ${userId}`, {
      token: token.substring(0, 10) + '...',
      expiry: expiry.toISOString()
    });
  }

  /**
   * Verifica se um token está na blacklist
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    // Verificar primeiro na memória (rápido)
    if (this.blacklist.has(token)) {
      return true;
    }

    // Verificar no banco de dados
    try {
      const blacklistedToken = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });

      if (blacklistedToken) {
        // Se encontrado, adicionar à memória para próxima verificação rápida
        this.blacklist.add(token);
        return true;
      }
    } catch (error) {
      this.logger.error('Erro ao verificar token blacklistado', error);
    }

    return false;
  }

  /**
   * Remove tokens expirados do banco
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const _now = new Date();
      const result = await this.prisma.blacklistedToken.deleteMany({
        where: {
          expiresAt: {
            lt: _now,
          },
        },
      });

      this.logger.log(`Removidos ${result.count} tokens expirados da blacklist`);
    } catch (error) {
      this.logger.error('Erro ao limpar tokens expirados', error);
    }
  }

  /**
   * Revoga todos os tokens de um usuário (logout completo)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      // Buscar todos os refresh tokens do usuário
      const refreshTokens = await this.prisma.refreshToken.findMany({
        where: { userId },
      });

      // Adicionar todos à blacklist
      const _now = new Date();
      for (const refreshToken of refreshTokens) {
        await this.blacklistToken(refreshToken.token, refreshToken.expiresAt, userId);
      }

      // Remover refresh tokens do banco
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log(`Revogados todos os tokens do usuário ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao revogar tokens do usuário ${userId}`, error);
      throw error;
    }
  }

  /**
   * Limpa toda a blacklist (usado em manutenção)
   */
  async clearBlacklist(): Promise<void> {
    this.blacklist.clear();
    try {
      await this.prisma.blacklistedToken.deleteMany({});
      this.logger.log('Blacklist completamente limpa');
    } catch (error) {
      this.logger.error('Erro ao limpar blacklist', error);
      throw error;
    }
  }
}