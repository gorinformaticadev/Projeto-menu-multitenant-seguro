import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TwoFactorService } from './two-factor.service';
import { TokenBlacklistService } from '../common/services/token-blacklist.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';

type TokenGenerationInput = {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionVersion: number;
};

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
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.isLocked) {
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
          `Conta bloqueada por multiplas tentativas de login. Tente novamente em ${minutesRemaining} minuto(s) ou contate um administrador.`,
        );
      }

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

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const securityConfig = await this.prisma.securityConfig.findFirst();
      const maxAttempts = securityConfig?.loginMaxAttempts || 5;
      const lockDurationMinutes = securityConfig?.loginLockDurationMinutes || 30;
      const newAttempts = user.loginAttempts + 1;

      const updateData: any = {
        loginAttempts: newAttempts,
        lastFailedLoginAt: new Date(),
      };

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
          `Conta bloqueada por multiplas tentativas de login. Tente novamente em ${lockDurationMinutes} minutos ou contate um administrador.`,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      const attemptsRemaining = maxAttempts - newAttempts;
      let errorMessage = 'Credenciais invalidas';

      if (attemptsRemaining === 1) {
        errorMessage = `Credenciais invalidas. ATENCAO: Voce tem apenas ${attemptsRemaining} tentativa restante antes de sua conta ser bloqueada por ${lockDurationMinutes} minutos.`;
      } else if (attemptsRemaining <= 3) {
        errorMessage = `Credenciais invalidas. Voce tem ${attemptsRemaining} tentativas restantes.`;
      }

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

    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lastFailedLoginAt: null,
        },
      });
    }

    const securityConfig = await this.prisma.securityConfig.findFirst();
    const is2FARequired = securityConfig?.twoFactorRequired || false;
    const is2FARequiredForAdmins = securityConfig?.twoFactorRequiredForAdmins || false;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    if ((is2FARequired || (is2FARequiredForAdmins && isAdmin)) && !user.twoFactorEnabled) {
      await this.auditService.log({
        action: 'LOGIN_2FA_REQUIRED',
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
        details: {
          email,
          reason: is2FARequired ? '2fa_globally_required' : '2fa_required_for_admins',
          role: user.role,
        },
      });

      throw new UnauthorizedException(
        '2FA e obrigatorio para sua conta. Por favor, ative a autenticacao de dois fatores antes de fazer login.',
      );
    }

    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionVersion: this.readSessionVersion(user),
    });

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
      user: this.toUserResponse(user),
    };
  }

  async generateTokens(input: TokenGenerationInput) {
    const payload = {
      sub: input.userId,
      email: input.email,
      role: input.role,
      tenantId: input.tenantId,
      sessionVersion: input.sessionVersion,
      jti: crypto.randomUUID(),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.calculateExpirationDate(expiresIn);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: input.userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    if (await this.tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { tenant: true } } },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    const tokens = await this.generateTokens({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
      tenantId: storedToken.user.tenantId,
      sessionVersion: this.readSessionVersion(storedToken.user),
    });

    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

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
      user: this.toUserResponse(storedToken.user),
    };
  }

  async logout(
    refreshToken: string,
    userId: string,
    accessToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken && storedToken.userId === userId) {
      await this.tokenBlacklistService.blacklistToken(refreshToken, storedToken.expiresAt, userId);
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
    }

    await this.blacklistAccessToken(accessToken, userId);

    await this.auditService.log({
      action: 'LOGOUT',
      userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Logout realizado com sucesso' };
  }

  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  async login2FA(login2FADto: Login2FADto, ipAddress?: string, userAgent?: string) {
    const { email, password, twoFactorToken } = login2FADto;

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
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - new Date().getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Conta bloqueada. Tente novamente em ${minutesRemaining} minuto(s).`,
      );
    }

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
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA nao esta ativado para este usuario');
    }

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
      throw new UnauthorizedException('Codigo 2FA invalido');
    }

    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lastFailedLoginAt: null,
        },
      });
    }

    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionVersion: this.readSessionVersion(user),
    });

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
      user: this.toUserResponse(user),
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    return {
      ...this.toUserResponse(user),
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  private async blacklistAccessToken(accessToken: string | undefined, userId: string): Promise<void> {
    if (!accessToken) {
      return;
    }

    const decoded = this.jwtService.decode(accessToken);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.exp !== 'number') {
      return;
    }

    const expiry = new Date(decoded.exp * 1000);
    if (expiry <= new Date()) {
      return;
    }

    await this.tokenBlacklistService.blacklistToken(accessToken, expiry, userId);
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    tenant?: unknown;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
      twoFactorSecret: undefined,
    };
  }

  private readSessionVersion(user: { sessionVersion?: number | null } | Record<string, unknown>) {
    const rawValue = (user as { sessionVersion?: number | null }).sessionVersion;
    return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
  }
}
