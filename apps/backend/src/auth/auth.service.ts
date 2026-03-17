import { Injectable, UnauthorizedException, Inject, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TwoFactorService } from './two-factor.service';
import { TokenBlacklistService } from '../common/services/token-blacklist.service';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';
import { UserSessionService } from './user-session.service';
import { TrustedDeviceService } from './trusted-device.service';
import { TwoFactorRequiredException } from './exceptions/two-factor-required.exception';

type TokenGenerationInput = {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  sessionVersion: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type GeneratedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string;
};

type RefreshTokenWriter = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
    @Inject(forwardRef(() => TwoFactorService))
    private twoFactorService: TwoFactorService,
    private tokenBlacklistService: TokenBlacklistService,
    private securityConfigService: SecurityConfigService,
    private userSessionService: UserSessionService,
    private trustedDeviceService: TrustedDeviceService,
  ) {}

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
    trustedDeviceToken?: string,
  ) {
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
      const loginPolicy = await this.securityConfigService.getLoginRateLimit();
      const maxAttempts = loginPolicy.maxAttempts ?? 5;
      const lockDurationMinutes = loginPolicy.lockDurationMinutes ?? 30;
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

        this.logger.warn(
          `login_lockout userId=${user.id} tenantId=${user.tenantId || 'global'} attempts=${newAttempts} lockDurationMinutes=${lockDurationMinutes}`,
        );

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

    const twoFactorPolicy = await this.securityConfigService.getTwoFactorConfig();
    const is2FAGloballyEnabled = twoFactorPolicy.enabled === true;
    const is2FARequired = is2FAGloballyEnabled && twoFactorPolicy.required === true;
    const is2FARequiredForAdmins =
      is2FAGloballyEnabled && twoFactorPolicy.requiredForAdmins === true;
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

    let trustedDeviceUsedForBypass = false;
    let shouldClearTrustedDeviceCookie = false;

    if (is2FAGloballyEnabled && user.twoFactorEnabled) {
      const trustedDeviceValidation = await this.trustedDeviceService.validateTrustedDevice({
        token: trustedDeviceToken,
        userId: user.id,
        ipAddress,
        userAgent,
      });

      trustedDeviceUsedForBypass = trustedDeviceValidation.shouldBypass2FA;
      shouldClearTrustedDeviceCookie = trustedDeviceValidation.shouldClearCookie;

      if (trustedDeviceValidation.status === 'valid') {
        await this.auditService.log({
          action: 'TRUSTED_DEVICE_USED',
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          details: {
            trustedDeviceId: trustedDeviceValidation.trustedDeviceId,
            status: trustedDeviceValidation.status,
          },
        });
      } else if (trustedDeviceValidation.status !== 'missing') {
        await this.auditService.log({
          action: 'TRUSTED_DEVICE_INVALID',
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          details: {
            trustedDeviceId: trustedDeviceValidation.trustedDeviceId,
            status: trustedDeviceValidation.status,
          },
        });
      }

      if (!trustedDeviceUsedForBypass) {
        await this.auditService.log({
          action: 'LOGIN_2FA_CHALLENGE',
          userId: user.id,
          tenantId: user.tenantId,
          ipAddress,
          userAgent,
          details: {
            email,
            reason: 'user_has_2fa_enabled',
            role: user.role,
            trustedDeviceStatus: trustedDeviceValidation.status,
          },
        });

        throw new TwoFactorRequiredException(
          '2FA necessario para concluir o login. Informe o codigo de autenticacao.',
          shouldClearTrustedDeviceCookie,
        );
      }
    }

    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sessionVersion: this.readSessionVersion(user),
      ipAddress,
      userAgent,
    });

    await this.auditService.log({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      details: {
        email,
        trustedDeviceBypass: trustedDeviceUsedForBypass,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: this.toUserResponse(user),
    };
  }

  async generateTokens(
    input: TokenGenerationInput,
    refreshTokenWriter: RefreshTokenWriter = this.prisma,
  ): Promise<GeneratedTokens> {
    const session =
      input.sessionId
        ? { id: input.sessionId }
        : await this.userSessionService.createSession(input.userId, input.tenantId, {
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          });

    const payload = {
      sub: input.userId,
      email: input.email,
      role: input.role,
      tenantId: input.tenantId,
      sessionVersion: input.sessionVersion,
      sid: session.id,
      jti: crypto.randomUUID(),
    };

    const tokenPolicy = await this.securityConfigService.getJwtConfig();
    const accessTokenExpiresIn = this.normalizeJwtExpiresIn(
      tokenPolicy.accessTokenExpiresIn,
      this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    const refreshTokenExpiresIn = this.normalizeDurationString(
      tokenPolicy.refreshTokenExpiresIn,
      this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = this.calculateExpirationDate(refreshTokenExpiresIn);
    const accessTokenExpiresAt = this.extractJwtExpiry(accessToken);

    await refreshTokenWriter.refreshToken.create({
      data: {
        token: refreshToken,
        userId: input.userId,
        sessionId: session.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    if (await this.tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const refreshResult = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const storedToken = await tx.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { include: { tenant: true } }, session: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token invalido');
      }

      if (storedToken.expiresAt < now) {
        await tx.refreshToken.deleteMany({
          where: { id: storedToken.id },
        });
        throw new UnauthorizedException('Refresh token expirado');
      }

      if (!storedToken.sessionId) {
        await tx.refreshToken.deleteMany({
          where: { id: storedToken.id },
        });
        throw new UnauthorizedException('Sessao legada expirada; faca login novamente');
      }

      await this.userSessionService.assertRefreshSessionActive(
        storedToken.sessionId,
        storedToken.user.id,
      );

      const consumed = await tx.refreshToken.deleteMany({
        where: {
          id: storedToken.id,
          token: refreshToken,
          expiresAt: {
            gte: now,
          },
        },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Refresh token invalido ou ja utilizado');
      }

      const tokens = await this.generateTokens(
        {
          userId: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
          tenantId: storedToken.user.tenantId,
          sessionVersion: this.readSessionVersion(storedToken.user),
          sessionId: storedToken.sessionId,
        },
        tx,
      );

      return {
        storedToken,
        tokens,
      };
    });

    await this.auditService.log({
      action: 'TOKEN_REFRESHED',
      userId: refreshResult.storedToken.user.id,
      tenantId: refreshResult.storedToken.user.tenantId,
      ipAddress,
      userAgent,
      details: { email: refreshResult.storedToken.user.email },
    });

    return {
      accessToken: refreshResult.tokens.accessToken,
      refreshToken: refreshResult.tokens.refreshToken,
      accessTokenExpiresAt: refreshResult.tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: refreshResult.tokens.refreshTokenExpiresAt,
      user: this.toUserResponse(refreshResult.storedToken.user),
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

    let sessionId = this.resolveSessionIdFromAccessToken(accessToken);

    if (storedToken && storedToken.userId === userId) {
      await this.tokenBlacklistService.blacklistToken(refreshToken, storedToken.expiresAt, userId);
      sessionId = storedToken.sessionId || sessionId;
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
    }

    if (sessionId) {
      await this.userSessionService.revokeSession(sessionId, 'logout');
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

  private extractJwtExpiry(token: string): string | null {
    const decoded = this.jwtService.decode(token);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.exp !== 'number') {
      return null;
    }

    return new Date(decoded.exp * 1000).toISOString();
  }

  private normalizeJwtExpiresIn(value: unknown, fallback: unknown): StringValue {
    return this.normalizeDurationString(value, fallback) as StringValue;
  }

  private normalizeDurationString(value: unknown, fallback: unknown): string {
    const normalized = String(value ?? '').trim();
    if (normalized.length > 0) {
      return normalized;
    }

    const normalizedFallback = String(fallback ?? '').trim();
    return normalizedFallback.length > 0 ? normalizedFallback : '15m';
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

    const twoFactorPolicy = await this.securityConfigService.getTwoFactorConfig();
    if (twoFactorPolicy.enabled !== true) {
      throw new UnauthorizedException('2FA desabilitado globalmente');
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
      ipAddress,
      userAgent,
    });

    let trustedDeviceToken: string | undefined;
    let trustedDeviceExpiresAt: Date | undefined;

    if (login2FADto.trustDevice === true) {
      const issuedTrustedDevice = await this.trustedDeviceService.issueTrustedDevice({
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
      });
      trustedDeviceToken = issuedTrustedDevice.token;
      trustedDeviceExpiresAt = issuedTrustedDevice.expiresAt;
    }

    await this.auditService.log({
      action: 'LOGIN_2FA_SUCCESS',
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      details: {
        email,
        trustDevice: login2FADto.trustDevice === true,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: this.toUserResponse(user),
      trustedDeviceToken,
      trustedDeviceExpiresAt,
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

  private resolveSessionIdFromAccessToken(accessToken: string | undefined): string | null {
    if (!accessToken) {
      return null;
    }

    const decoded = this.jwtService.decode(accessToken);
    if (!decoded || typeof decoded !== 'object') {
      return null;
    }

    const sessionId = (decoded as { sid?: unknown }).sid;
    return typeof sessionId === 'string' && sessionId.trim().length > 0 ? sessionId : null;
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    avatarUrl?: string | null;
    tenant?: unknown;
  }) {
    const avatarUrl = user.avatarUrl
      ? `/api/users/public/${encodeURIComponent(user.id)}/avatar-file`
      : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      avatarUrl,
      tenant: user.tenant,
      twoFactorSecret: undefined,
    };
  }

  private readSessionVersion(user: { sessionVersion?: number | null } | Record<string, unknown>) {
    const rawValue = (user as { sessionVersion?: number | null }).sessionVersion;
    return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
  }
}
