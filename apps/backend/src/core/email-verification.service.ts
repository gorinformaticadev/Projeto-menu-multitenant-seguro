import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmailVerificationService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  /**
   * Gerar e enviar token de verificaÃ§Ã£o de email
   */
  async sendVerificationEmail(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('UsuÃ¡rio nÃ£o encontrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email jÃ¡ verificado');
    }

    // Gerar token JWT de verificaÃ§Ã£o (vÃ¡lido por 24 horas)
    const verificationToken = this.jwtService.sign(
      { userId: user.id, email: user.email, type: 'email_verification' },
      { expiresIn: '24h' }
    );

    // Calcular expiraÃ§Ã£o
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Salvar token no banco
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt,
      },
    });

    // Enviar email
    await this.emailService.sendVerificationEmail(user.email, user.name, verificationToken);

    // Log de auditoria
    await this.auditService.log({
      action: 'EMAIL_VERIFICATION_SENT',
      userId: user.id,
      tenantId: user.tenantId,
      details: { email: user.email },
    });

    return { message: 'Email de verificaÃ§Ã£o enviado com sucesso' };
  }

  /**
   * Verificar email com token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      // Validar token JWT
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'email_verification') {
        throw new BadRequestException('Token invÃ¡lido');
      }

      // Buscar usuÃ¡rio
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new BadRequestException('UsuÃ¡rio nÃ£o encontrado');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email jÃ¡ verificado');
      }

      // Verificar se Ã© o token mais recente
      if (user.emailVerificationToken !== token) {
        throw new BadRequestException('Token invÃ¡lido ou expirado');
      }

      // Verificar expiraÃ§Ã£o
      if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
        throw new BadRequestException('Token expirado. Solicite um novo email de verificaÃ§Ã£o.');
      }

      // Marcar email como verificado
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      // Log de auditoria
      await this.auditService.log({
        action: 'EMAIL_VERIFIED',
        userId: user.id,
        tenantId: user.tenantId,
        details: { email: user.email },
      });

      return { message: 'Email verificado com sucesso!' };
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Token invÃ¡lido');
      }
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Token expirado. Solicite um novo email de verificaÃ§Ã£o.');
      }
      throw error;
    }
  }

  /**
   * Verificar se email estÃ¡ verificado e se deve bloquear acesso
   */
  async checkEmailVerification(userId: string): Promise<{
    verified: boolean;
    required: boolean;
    level: string;
    shouldBlock: boolean;
    message?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('UsuÃ¡rio nÃ£o encontrado');
    }

    const securityConfig = await this.prisma.securityConfig.findFirst();
    const required = securityConfig?.emailVerificationRequired || false;
    const level = securityConfig?.emailVerificationLevel || 'SOFT';

    // Se email jÃ¡ verificado, permitir acesso
    if (user.emailVerified) {
      return {
        verified: true,
        required,
        level,
        shouldBlock: false,
      };
    }

    // Se verificaÃ§Ã£o nÃ£o Ã© obrigatÃ³ria, apenas avisar
    if (!required) {
      return {
        verified: false,
        required: false,
        level: 'SOFT',
        shouldBlock: false,
        message: 'Recomendamos verificar seu email para maior seguranÃ§a',
      };
    }

    // VerificaÃ§Ã£o obrigatÃ³ria - verificar nÃ­vel
    if (level === 'SOFT') {
      return {
        verified: false,
        required: true,
        level: 'SOFT',
        shouldBlock: false,
        message: 'Por favor, verifique seu email. Um link de verificaÃ§Ã£o foi enviado.',
      };
    } else if (level === 'MODERATE') {
      return {
        verified: false,
        required: true,
        level: 'MODERATE',
        shouldBlock: true,
        message: 'Funcionalidades limitadas. Verifique seu email para acesso completo.',
      };
    } else if (level === 'STRICT') {
      return {
        verified: false,
        required: true,
        level: 'STRICT',
        shouldBlock: true,
        message: 'Acesso bloqueado. Verifique seu email para continuar.',
      };
    }

    return {
      verified: false,
      required,
      level,
      shouldBlock: false,
    };
  }
}

