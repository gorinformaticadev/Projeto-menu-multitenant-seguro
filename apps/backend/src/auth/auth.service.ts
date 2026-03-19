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
import { Complete2FAEnrollmentDto } from './dto/complete-2fa-enrollment.dto';

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

type AuthenticatedLoginResponse = GeneratedTokens & {
  status: 'AUTHENTICATED';
  authenticated: true;
  requiresTwoFactor: false;
  mustEnrollTwoFactor: false;
  user: ReturnType<AuthService['toUserResponse']>;
  trustedDeviceToken?: string;
  trustedDeviceExpiresAt?: Date;
};

type TwoFactorChallengeResponse = {
  status: 'REQUIRES_TWO_FACTOR';
  authenticated: false;
  requiresTwoFactor: true;
  mustEnrollTwoFactor: false;
  clearTrustedDeviceCookie: boolean;
};

type TwoFactorEnrollmentRequiredResponse = {
  status: 'MUST_ENROLL_TWO_FACTOR';
  authenticated: false;
  requiresTwoFactor: false;
  mustEnrollTwoFactor: true;
  enrollmentToken: string;
  enrollmentExpiresAt: string;
};

export type LoginFlowResponse =
  | AuthenticatedLoginResponse
  | TwoFactorChallengeResponse
  | TwoFactorEnrollmentRequiredResponse;

type TwoFactorEnrollmentPayload = {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  purpose: 'two-factor-enrollment';
};

type AuthCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_TWO_FACTOR_TOKEN'
  | 'TWO_FACTOR_NOT_CONFIGURED'
  | 'TWO_FACTOR_DISABLED'
  | 'ENROLLMENT_SESSION_INVALID';

type UserRecord = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenant?: unknown;
  avatarUrl?: string | null;
  twoFactorEnabled?: boolean | null;
  twoFactorSecret?: string | null;
  loginAttempts: number;
  isLocked: boolean;
  lockedUntil?: Date | null;
  sessionVersion?: number | null;
};

type UserLookupResult = UserRecord & {
  tenant?: unknown;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly twoFactorEnrollmentExpiresIn = '10m';

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
  ): Promise<LoginFlowResponse> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true, preferences: true },
    });

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Credenciais invalidas');
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

        throw this.buildUnauthorizedException(
          'ACCOUNT_LOCKED',
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

      const updateData: Prisma.UserUpdateInput = {
        loginAttempts: newAttempts,
        lastFailedLoginAt: new Date(),
      };

      if (newAttempts >= maxAttempts) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDurationMinutes);

        Object.assign(updateData, {
          isLocked: true,
          lockedAt: new Date(),
          lockedUntil,
        });

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

        throw this.buildUnauthorizedException(
          'ACCOUNT_LOCKED',
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

      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', errorMessage);
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
    const mustEnrollTwoFactor =
      (is2FARequired || (is2FARequiredForAdmins && isAdmin)) && !user.twoFactorEnabled;

    if (mustEnrollTwoFactor) {
      const enrollment = this.issueTwoFactorEnrollmentToken(user);

      await this.auditService.log({
        action: 'LOGIN_2FA_ENROLLMENT_REQUIRED',
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

      return {
        status: 'MUST_ENROLL_TWO_FACTOR',
        authenticated: false,
        requiresTwoFactor: false,
        mustEnrollTwoFactor: true,
        enrollmentToken: enrollment.token,
        enrollmentExpiresAt: enrollment.expiresAt.toISOString(),
      };
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

        return {
          status: 'REQUIRES_TWO_FACTOR',
          authenticated: false,
          requiresTwoFactor: true,
          mustEnrollTwoFactor: false,
          clearTrustedDeviceCookie: shouldClearTrustedDeviceCookie,
        };
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

    return this.buildAuthenticatedResponse(user, tokens);
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
      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Refresh token invalido');
    }

    const refreshResult = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const storedToken = await tx.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { include: { tenant: true, preferences: true } }, session: true },
      });

      if (!storedToken) {
        throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Refresh token invalido');
      }

      if (storedToken.expiresAt < now) {
        await tx.refreshToken.deleteMany({
          where: { id: storedToken.id },
        });
        throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Refresh token expirado');
      }

      if (!storedToken.sessionId) {
        await tx.refreshToken.deleteMany({
          where: { id: storedToken.id },
        });
        throw this.buildUnauthorizedException(
          'INVALID_CREDENTIALS',
          'Sessao legada expirada; faca login novamente',
        );
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
        throw this.buildUnauthorizedException(
          'INVALID_CREDENTIALS',
          'Refresh token invalido ou ja utilizado',
        );
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

    return this.buildAuthenticatedResponse(refreshResult.storedToken.user, refreshResult.tokens);
  }

  async logout(
    refreshToken: string,
    userId?: string,
    accessToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const storedToken = refreshToken
      ? await this.prisma.refreshToken.findUnique({
          where: { token: refreshToken },
        })
      : null;

    let sessionId = this.resolveSessionIdFromAccessToken(accessToken);
    const targetUserId = userId || storedToken?.userId;

    if (storedToken) {
      // Se veio sem userId (fluxo tolerante) ou bate com o dono do token
      if (!userId || storedToken.userId === userId) {
        await this.tokenBlacklistService.blacklistToken(
          refreshToken,
          storedToken.expiresAt,
          storedToken.userId,
        );
        sessionId = storedToken.sessionId || sessionId;
        await this.prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });
      }
    }

    if (sessionId) {
      await this.userSessionService.revokeSession(sessionId, 'logout');
    }

    if (accessToken && targetUserId) {
      await this.blacklistAccessToken(accessToken, targetUserId);
    }

    if (targetUserId) {
      await this.auditService.log({
        action: 'LOGOUT',
        userId: targetUserId,
        ipAddress,
        userAgent,
      });
    }

    return { message: 'Logout realizado com sucesso' };
  }


  async login2FA(
    login2FADto: Login2FADto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthenticatedLoginResponse> {
    const { email, password, twoFactorToken } = login2FADto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true, preferences: true },
    });

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN_2FA_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Credenciais invalidas');
    }

    if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - new Date().getTime()) / 60000,
      );
      throw this.buildUnauthorizedException(
        'ACCOUNT_LOCKED',
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
      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Credenciais invalidas');
    }

    const twoFactorPolicy = await this.securityConfigService.getTwoFactorConfig();
    if (twoFactorPolicy.enabled !== true) {
      throw this.buildUnauthorizedException('TWO_FACTOR_DISABLED', '2FA desabilitado globalmente');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw this.buildUnauthorizedException(
        'TWO_FACTOR_NOT_CONFIGURED',
        '2FA nao esta ativado para este usuario',
      );
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
      throw this.buildUnauthorizedException('INVALID_TWO_FACTOR_TOKEN', 'Codigo 2FA invalido');
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
      ...this.buildAuthenticatedResponse(user, tokens),
      trustedDeviceToken,
      trustedDeviceExpiresAt,
    };
  }

  async generateTwoFactorEnrollmentSecret(enrollmentToken: string) {
    const user = await this.resolveEnrollmentUser(enrollmentToken);
    return this.twoFactorService.generateSecret(user.id);
  }

  async completeTwoFactorEnrollment(
    enrollmentToken: string,
    dto: Complete2FAEnrollmentDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthenticatedLoginResponse> {
    const user = await this.resolveEnrollmentUser(enrollmentToken);

    await this.twoFactorService.enable(user.id, dto.token, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      userAgent,
      auditAction: 'TWO_FACTOR_ENROLLMENT_COMPLETED',
    });

    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { tenant: true },
    });

    if (!refreshedUser) {
      throw this.buildUnauthorizedException('ENROLLMENT_SESSION_INVALID', 'Usuario nao encontrado');
    }

    const tokens = await this.generateTokens({
      userId: refreshedUser.id,
      email: refreshedUser.email,
      role: refreshedUser.role,
      tenantId: refreshedUser.tenantId,
      sessionVersion: this.readSessionVersion(refreshedUser),
      ipAddress,
      userAgent,
    });

    let trustedDeviceToken: string | undefined;
    let trustedDeviceExpiresAt: Date | undefined;

    if (dto.trustDevice === true) {
      const issuedTrustedDevice = await this.trustedDeviceService.issueTrustedDevice({
        userId: refreshedUser.id,
        tenantId: refreshedUser.tenantId,
        ipAddress,
        userAgent,
      });
      trustedDeviceToken = issuedTrustedDevice.token;
      trustedDeviceExpiresAt = issuedTrustedDevice.expiresAt;
    }

    await this.auditService.log({
      action: 'LOGIN_SUCCESS',
      userId: refreshedUser.id,
      tenantId: refreshedUser.tenantId,
      ipAddress,
      userAgent,
      details: {
        email: refreshedUser.email,
        enrollmentCompleted: true,
        trustDevice: dto.trustDevice === true,
      },
    });

    return {
      ...this.buildAuthenticatedResponse(refreshedUser, tokens),
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
      include: { tenant: true, preferences: true },
    });

    if (!user) {
      throw this.buildUnauthorizedException('INVALID_CREDENTIALS', 'Usuario nao encontrado');
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

  private buildAuthenticatedResponse(
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId: string | null;
      avatarUrl?: string | null;
      tenant?: unknown;
    },
    tokens: GeneratedTokens,
  ): AuthenticatedLoginResponse {
    return {
      status: 'AUTHENTICATED',
      authenticated: true,
      requiresTwoFactor: false,
      mustEnrollTwoFactor: false,
      ...tokens,
      user: this.toUserResponse(user),
    };
  }

  private issueTwoFactorEnrollmentToken(user: UserLookupResult): { token: string; expiresAt: Date } {
    const payload: TwoFactorEnrollmentPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      purpose: 'two-factor-enrollment',
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: this.twoFactorEnrollmentExpiresIn,
    });

    const expiresAt = this.extractJwtExpiryDate(token);

    return {
      token,
      expiresAt,
    };
  }

  private async resolveEnrollmentUser(enrollmentToken: string): Promise<UserLookupResult> {
    const normalizedToken = String(enrollmentToken || '').trim();
    if (!normalizedToken) {
      throw this.buildUnauthorizedException(
        'ENROLLMENT_SESSION_INVALID',
        'Sessao temporaria de configuracao do 2FA ausente ou expirada',
      );
    }

    let payload: TwoFactorEnrollmentPayload;
    try {
      payload = this.jwtService.verify<TwoFactorEnrollmentPayload>(normalizedToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw this.buildUnauthorizedException(
        'ENROLLMENT_SESSION_INVALID',
        'Sessao temporaria de configuracao do 2FA ausente ou expirada',
      );
    }

    if (payload.purpose !== 'two-factor-enrollment' || !payload.sub) {
      throw this.buildUnauthorizedException(
        'ENROLLMENT_SESSION_INVALID',
        'Sessao temporaria de configuracao do 2FA invalida',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || user.email !== payload.email || user.role !== payload.role || user.tenantId !== payload.tenantId) {
      throw this.buildUnauthorizedException(
        'ENROLLMENT_SESSION_INVALID',
        'Sessao temporaria de configuracao do 2FA invalida',
      );
    }

    if (user.twoFactorEnabled) {
      throw this.buildUnauthorizedException(
        'ENROLLMENT_SESSION_INVALID',
        '2FA ja foi configurado para esta conta. Faça login novamente.',
      );
    }

    return user;
  }

  private extractJwtExpiry(token: string): string | null {
    const decoded = this.jwtService.decode(token);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.exp !== 'number') {
      return null;
    }

    return new Date(decoded.exp * 1000).toISOString();
  }

  private extractJwtExpiryDate(token: string): Date {
    const expiresAt = this.extractJwtExpiry(token);
    if (!expiresAt) {
      return this.calculateExpirationDate(this.twoFactorEnrollmentExpiresIn);
    }

    const parsed = new Date(expiresAt);
    return Number.isNaN(parsed.getTime())
      ? this.calculateExpirationDate(this.twoFactorEnrollmentExpiresIn)
      : parsed;
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

  private toUserResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    avatarUrl?: string | null;
    tenant?: unknown;
    preferences?: { theme: string } | null;
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
      tenant: this.toTenantResponse(user.tenant),
      preferences: user.preferences ? { theme: user.preferences.theme } : null,
    };
  }

  private toTenantResponse(tenant: unknown) {
    if (!tenant || typeof tenant !== 'object' || Array.isArray(tenant)) {
      return null;
    }

    const row = tenant as {
      id?: string;
      nomeFantasia?: string;
      cnpjCpf?: string;
      telefone?: string;
      logoUrl?: string | null;
      email?: string;
    };

    if (
      typeof row.id !== 'string' ||
      typeof row.nomeFantasia !== 'string' ||
      typeof row.cnpjCpf !== 'string' ||
      typeof row.telefone !== 'string'
    ) {
      return null;
    }

    return {
      id: row.id,
      nomeFantasia: row.nomeFantasia,
      cnpjCpf: row.cnpjCpf,
      telefone: row.telefone,
      logoUrl: row.logoUrl || undefined,
      email: typeof row.email === 'string' ? row.email : undefined,
    };
  }

  private readSessionVersion(user: { sessionVersion?: number | null } | Record<string, unknown>) {
    const rawValue = (user as { sessionVersion?: number | null }).sessionVersion;
    return typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0;
  }

  private buildUnauthorizedException(code: AuthCode, message: string): UnauthorizedException {
    const exception = new UnauthorizedException(message);
    (exception as UnauthorizedException & { authCode?: AuthCode }).authCode = code;
    return exception;
  }
}
