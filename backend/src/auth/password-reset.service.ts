import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Solicitar recuperação de senha
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      // Verificar se o usuário existe
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Por segurança, sempre retornamos sucesso mesmo se o email não existir
      // Isso evita que atacantes descubram quais emails estão cadastrados
      if (!user) {
        this.logger.warn(`Tentativa de reset de senha para email não cadastrado: ${email}`);
        return {
          message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
        };
      }

      // Verificar se o usuário não está bloqueado
      if (user.isLocked) {
        this.logger.warn(`Tentativa de reset de senha para usuário bloqueado: ${email}`);
        return {
          message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
        };
      }

      // Gerar token JWT para reset de senha (expira em 1 hora)
      const resetToken = this.jwtService.sign(
        { 
          userId: user.id, 
          email: user.email,
          type: 'password-reset'
        },
        {
          secret: this.config.get('JWT_SECRET'),
          expiresIn: '1h', // Token expira em 1 hora
        }
      );

      // Salvar o token no banco de dados para validação posterior
      await (this.prisma as any).passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        },
      });

      // Enviar email de recuperação
      const emailSent = await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      );

      if (!emailSent) {
        this.logger.error(`Falha ao enviar email de recuperação para: ${email}`);
        throw new BadRequestException('Erro interno. Tente novamente mais tarde.');
      }

      this.logger.log(`Email de recuperação enviado para: ${email}`);
      
      return {
        message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
      };

    } catch (error) {
      this.logger.error('Erro ao processar solicitação de reset de senha:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erro interno. Tente novamente mais tarde.');
    }
  }

  /**
   * Redefinir senha com token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      // Verificar e decodificar o token
      let payload;
      try {
        payload = this.jwtService.verify(token, {
          secret: this.config.get('JWT_SECRET'),
        });
      } catch (error) {
        this.logger.warn('Token de reset inválido ou expirado');
        throw new BadRequestException('Token inválido ou expirado. Solicite um novo link de recuperação.');
      }

      // Verificar se é um token de reset de senha
      if (payload.type !== 'password-reset') {
        this.logger.warn('Token não é do tipo password-reset');
        throw new BadRequestException('Token inválido.');
      }

      // Verificar se o token existe no banco de dados e não foi usado
      const resetTokenRecord = await (this.prisma as any).passwordResetToken.findFirst({
        where: {
          token,
          userId: payload.userId,
          usedAt: null,
          expiresAt: {
            gt: new Date(), // Token não expirado
          },
        },
        include: {
          user: true,
        },
      });

      if (!resetTokenRecord) {
        this.logger.warn('Token de reset não encontrado ou já usado');
        throw new BadRequestException('Token inválido ou expirado. Solicite um novo link de recuperação.');
      }

      // Verificar se o usuário ainda existe e não está bloqueado
      if (!resetTokenRecord.user || resetTokenRecord.user.isLocked) {
        this.logger.warn('Usuário não encontrado ou bloqueado');
        throw new BadRequestException('Usuário não encontrado ou bloqueado.');
      }

      // Hash da nova senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar a senha do usuário e marcar o token como usado
      await this.prisma.$transaction([
        // Atualizar senha do usuário
        this.prisma.user.update({
          where: { id: resetTokenRecord.userId },
          data: {
            password: hashedPassword,
            // Resetar tentativas de login se houver
            loginAttempts: 0,
            lockedUntil: null,
          },
        }),
        // Marcar token como usado
        (this.prisma as any).passwordResetToken.update({
          where: { id: resetTokenRecord.id },
          data: { usedAt: new Date() },
        }),
        // Invalidar todos os outros tokens de reset do usuário
        (this.prisma as any).passwordResetToken.updateMany({
          where: {
            userId: resetTokenRecord.userId,
            usedAt: null,
            id: { not: resetTokenRecord.id },
          },
          data: { usedAt: new Date() },
        }),
      ]);

      this.logger.log(`Senha redefinida com sucesso para usuário: ${resetTokenRecord.user.email}`);

      return {
        message: 'Senha redefinida com sucesso. Você já pode fazer login com sua nova senha.',
      };

    } catch (error) {
      this.logger.error('Erro ao redefinir senha:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Erro interno. Tente novamente mais tarde.');
    }
  }

  /**
   * Limpar tokens expirados (pode ser chamado por um cron job)
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await (this.prisma as any).passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } }, // Tokens expirados
            { usedAt: { not: null } }, // Tokens já usados
          ],
        },
      });

      this.logger.log(`Limpeza de tokens: ${result.count} tokens removidos`);
    } catch (error) {
      this.logger.error('Erro ao limpar tokens expirados:', error);
    }
  }
}