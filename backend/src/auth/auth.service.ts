import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TwoFactorService } from './two-factor.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
    @Inject(forwardRef(() => TwoFactorService))
    private twoFactorService: TwoFactorService,
  ) { }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Busca o usuário pelo email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      // Log de tentativa de login falha
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se o usuário está bloqueado
    if (user.isLocked) {
      // Verificar se o bloqueio ainda está ativo
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesRemaining = Math.ceil(
          (user.lockedUntil.getTime() - new Date().getTime()) / 60000,
        );

        await this.auditService.log({
          action: 'LOGIN_BLOCKED',
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          details: { email, reason: 'account_locked', minutesRemaining },
        });

        throw new UnauthorizedException(
          `Conta bloqueada por múltiplas tentativas de login. Tente novamente em ${minutesRemaining} minuto(s) ou contate um administrador.`,
        );
      } else {
        // Bloqueio expirou, desbloquear automaticamente
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            isLocked: false,
            loginAttempts: 0,
            lockedAt: null,
            lockedUntil: null,
          },
        });
      }
    }

    // Verifica a senha usando bcrypt.compare()
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Buscar configurações de segurança
      const securityConfig = await this.prisma.securityConfig.findFirst();
      const maxAttempts = securityConfig?.loginMaxAttempts || 5;
      const lockDurationMinutes = securityConfig?.loginLockDurationMinutes || 30;

      // Incrementar tentativas de login
      const newAttempts = user.loginAttempts + 1;

      // Atualizar tentativas
      const updateData: any = {
        loginAttempts: newAttempts,
        lastFailedLoginAt: new Date(),
      };

      // Se atingiu o máximo de tentativas, bloquear
      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDurationMinutes);

        updateData.isLocked = true;
        updateData.lockedAt = new Date();
        updateData.lockedUntil = lockedUntil;

        await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        await this.auditService.log({
          action: 'ACCOUNT_LOCKED',
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          details: { email, attempts: newAttempts, lockedUntil, maxAttempts, lockDurationMinutes },
        });

        throw new UnauthorizedException(
          `Conta bloqueada por múltiplas tentativas de login. Tente novamente em ${lockDurationMinutes} minutos ou contate um administrador.`,
        );
      }

      // Atualizar tentativas sem bloquear
      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Avisar se está próximo do bloqueio (1 tentativa restante)
      const attemptsRemaining = maxAttempts - newAttempts;
      let errorMessage = 'Credenciais inválidas';

      if (attemptsRemaining === 1) {
        errorMessage = `Credenciais inválidas. ATENÇÃO: Você tem apenas ${attemptsRemaining} tentativa restante antes de sua conta ser bloqueada por ${lockDurationMinutes} minutos.`;
      } else if (attemptsRemaining <= 3) {
        errorMessage = `Credenciais inválidas. Você tem ${attemptsRemaining} tentativas restantes.`;
      }

      // Log de tentativa de login falha
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_password', attempts: newAttempts, attemptsRemaining, maxAttempts },
      });

      throw new UnauthorizedException(errorMessage);
    }

    // Login bem-sucedido - resetar tentativas
    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lastFailedLoginAt: null,
        },
      });
    }

    // Gera tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role, user.tenantId);

    // Log de login bem-sucedido
    await this.auditService.log({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      details: { email },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  /**
   * Gera access token e refresh token
   */
  async generateTokens(userId: string, email: string, role: string, tenantId: string | null) {
    const payload = {
      sub: userId,
      email,
      role,
      tenantId,
    };

    // Access Token: 15 minutos (configurável)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    // Refresh Token: token aleatório
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Salvar refresh token no banco
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.calculateExpirationDate(expiresIn);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Buscar refresh token no banco
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { tenant: true } } },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Verificar se expirou
    if (storedToken.expiresAt < new Date()) {
      // Remover token expirado
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Gerar novos tokens
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
      storedToken.user.tenantId,
    );

    // Remover refresh token antigo (rotação)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Log de refresh
    await this.auditService.log({
      action: 'TOKEN_REFRESHED',
      userId: storedToken.user.id,
      tenantId: storedToken.user.tenantId,
      ipAddress,
      userAgent,
      details: { email: storedToken.user.email },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        name: storedToken.user.name,
        role: storedToken.user.role,
        tenantId: storedToken.user.tenantId,
        tenant: storedToken.user.tenant,
      },
    };
  }

  /**
   * Logout - invalida refresh token
   */
  async logout(refreshToken: string, userId: string, ipAddress?: string, userAgent?: string) {
    // Remover refresh token
    await this.prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken,
        userId,
      },
    });

    // Log de logout
    await this.auditService.log({
      action: 'LOGOUT',
      userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Logout realizado com sucesso' };
  }

  /**
   * Calcular data de expiração baseado em string (ex: "7d", "30d")
   */
  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Padrão: 7 dias
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': // segundos
        return new Date(now.getTime() + value * 1000);
      case 'm': // minutos
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h': // horas
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd': // dias
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Login com 2FA
   */
  async login2FA(login2FADto: Login2FADto, ipAddress?: string, userAgent?: string) {
    const { email, password, twoFactorToken } = login2FADto;

    // Busca o usuário
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN_2FA_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se está bloqueado
    if (user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesRemaining = Math.ceil(
          (user.lockedUntil.getTime() - new Date().getTime()) / 60000,
        );
        throw new UnauthorizedException(
          `Conta bloqueada. Tente novamente em ${minutesRemaining} minuto(s).`,
        );
      }
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.auditService.log({
        action: 'LOGIN_2FA_FAILED',
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se 2FA está ativado
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA não está ativado para este usuário');
    }

    // Verificar código 2FA
    const is2FAValid = this.twoFactorService.verify(user.twoFactorSecret, twoFactorToken);

    if (!is2FAValid) {
      await this.auditService.log({
        action: 'LOGIN_2FA_FAILED',
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_2fa_token' },
      });
      throw new UnauthorizedException('Código 2FA inválido');
    }

    // Login bem-sucedido - resetar tentativas
    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lastFailedLoginAt: null,
        },
      });
    }

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role, user.tenantId);

    // Log de login bem-sucedido
    await this.auditService.log({
      action: 'LOGIN_2FA_SUCCESS',
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      details: { email },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Buscar dados do perfil do usuário
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
