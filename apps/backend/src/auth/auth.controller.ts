import {
  Controller,
  Post,
  Body,
  Ip,
  UseGuards,
  Get,
  Req,
  Res,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  authAuthenticatedResponseSchemasByVersion,
  authLoginFlowResponseSchemasByVersion,
  authMessageResponseSchema,
  authPaths,
  authTwoFactorSecretResponseSchema,
  authTwoFactorStatusResponseSchema,
  authUserSchemasByVersion,
} from '@contracts/auth';
import { API_CURRENT_VERSION, type ApiVersion } from '@contracts/http';
import { AuthService, LoginFlowResponse } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { type LoginDto, loginDtoSchema } from './dto/login.dto';
import { type Login2FADto, login2FADtoSchema } from './dto/login-2fa.dto';
import { type RefreshTokenDto, refreshTokenDtoSchema } from './dto/refresh-token.dto';
import { type LogoutDto, logoutDtoSchema } from './dto/logout.dto';
import { type Verify2FADto, verify2FADtoSchema } from './dto/verify-2fa.dto';
import { type VerifyEmailDto, verifyEmailDtoSchema } from './dto/verify-email.dto';
import { type ForgotPasswordDto, forgotPasswordDtoSchema } from './dto/forgot-password.dto';
import { type ResetPasswordDto, resetPasswordDtoSchema } from './dto/reset-password.dto';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@core/common/guards/optional-jwt-auth.guard';
import { SkipCsrf } from '@core/common/decorators/skip-csrf.decorator';
import { Request, Response } from 'express';
import {
  TRUSTED_DEVICE_COOKIE_NAME,
  buildTrustedDeviceCookieClearOptions,
  buildTrustedDeviceCookieOptions,
} from './trusted-device.constants';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  TWO_FACTOR_ENROLLMENT_COOKIE_NAME,
  buildAccessTokenCookieOptions,
  buildAuthCookieClearOptions,
  buildRefreshTokenCookieOptions,
  buildTwoFactorEnrollmentCookieOptions,
} from './auth-cookie.constants';
import {
  type Complete2FAEnrollmentDto,
  complete2FAEnrollmentDtoSchema,
} from './dto/complete-2fa-enrollment.dto';
import { assertContractResponse } from '../common/contracts/contract-response.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

type AuthenticatedRequest = Request & {
  user: { id: string; email?: string; role?: string };
  apiVersion?: string;
};

type AuthErrorWithCode = UnauthorizedException & { authCode?: string };

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    private emailVerificationService: EmailVerificationService,
    private passwordResetService: PasswordResetService,
    private securityConfigService: SecurityConfigService,
  ) {}

  /**
   * POST /auth/login
   * Rate Limiting: 5 tentativas por minuto
   * CSRF: Desabilitado - endpoint publico de autenticacao
   */
  @SkipCsrf()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body(new ZodValidationPipe(loginDtoSchema)) loginDto: LoginDto,
    @Req() req: Request & { apiVersion?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const apiVersion = this.getApiVersion(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const trustedDeviceToken = this.extractTrustedDeviceToken(req);

    try {
      const result = await this.authService.login(loginDto, ip, userAgent, trustedDeviceToken);
      return assertContractResponse(
        authLoginFlowResponseSchemasByVersion[apiVersion],
        this.finalizeAuthFlowResponse(result, res, apiVersion),
        authPaths.login,
      );
    } catch (error) {
      this.rethrowAuthContractError(error);
    }
  }

  /**
   * POST /auth/refresh
   * Renovar access token usando refresh token
   * CSRF: Desabilitado - usa refresh token como autenticacao
   */
  @SkipCsrf()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenDtoSchema)) refreshTokenDto: RefreshTokenDto,
    @Req() req: Request & { apiVersion?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const apiVersion = this.getApiVersion(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const refreshToken =
      refreshTokenDto.refreshToken || this.extractRefreshToken(req) || '';

    const result = await this.authService.refreshTokens(refreshToken, ip, userAgent);
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.accessTokenExpiresAt,
      result.refreshTokenExpiresAt,
    );
    return assertContractResponse(
      authAuthenticatedResponseSchemasByVersion[apiVersion],
      this.buildAuthenticatedResponse(result, apiVersion),
      authPaths.refresh,
    );
  }

  /**
   * POST /auth/logout
   * Invalidar refresh token (Tolerante a falhas)
   */
  @Post('logout')
  @UseGuards(OptionalJwtAuthGuard)
  async logout(
    @Body(new ZodValidationPipe(logoutDtoSchema)) logoutDto: LogoutDto,
    @Req() req: Request & { user?: { id?: string }; apiVersion?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const refreshToken =
      logoutDto.refreshToken || this.extractRefreshToken(req) || '';
    const accessToken = this.extractAccessToken(req);

    try {
      if (req.user?.id || refreshToken || accessToken) {
        await this.authService.logout(
          refreshToken,
          req.user?.id,
          accessToken,
          ip,
          userAgent,
        );
      }
    } catch (error) {
      console.warn('Logout fallback to cookie sweep due to error:', error);
    } finally {
      this.clearAuthCookies(res);
      this.clearTrustedDeviceCookie(res);
      this.clearTwoFactorEnrollmentCookie(res);
    }

    return assertContractResponse(
      authMessageResponseSchema,
      { message: 'Logout realizado com sucesso' },
      authPaths.logout,
    );
  }


  /**
   * POST /auth/login-2fa
   * Login com 2FA
   * CSRF: Desabilitado - endpoint publico de autenticacao
   */
  @SkipCsrf()
  @Post('login-2fa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login2FA(
    @Body(new ZodValidationPipe(login2FADtoSchema)) login2FADto: Login2FADto,
    @Req() req: Request & { apiVersion?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const apiVersion = this.getApiVersion(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    try {
      const result = await this.authService.login2FA(login2FADto, ip, userAgent);
      this.setAuthCookies(
        res,
        result.accessToken,
        result.refreshToken,
        result.accessTokenExpiresAt,
        result.refreshTokenExpiresAt,
      );

      if (result.trustedDeviceToken && result.trustedDeviceExpiresAt) {
        this.setTrustedDeviceCookie(res, result.trustedDeviceToken, result.trustedDeviceExpiresAt);
      }

      this.clearTwoFactorEnrollmentCookie(res);
      return assertContractResponse(
        authAuthenticatedResponseSchemasByVersion[apiVersion],
        this.buildAuthenticatedResponse(result, apiVersion),
        authPaths.login2fa,
      );
    } catch (error) {
      this.rethrowAuthContractError(error);
    }
  }

  /**
   * GET /auth/2fa/enrollment/generate
   * Gera QR Code durante o fluxo de login quando o usuario precisa obrigatoriamente se cadastrar em 2FA.
   */
  @Get('2fa/enrollment/generate')
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async generateEnrollment2FA(@Req() req: Request) {
    return assertContractResponse(
      authTwoFactorSecretResponseSchema,
      await this.authService.generateTwoFactorEnrollmentSecret(
        this.extractTwoFactorEnrollmentToken(req) || '',
      ),
      authPaths.twoFactorEnrollmentGenerate,
    );
  }

  /**
   * POST /auth/2fa/enrollment/enable
   * Conclui o enrollment obrigatorio e so entao emite a autenticacao final.
   */
  @Post('2fa/enrollment/enable')
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async enableEnrollment2FA(
    @Body(new ZodValidationPipe(complete2FAEnrollmentDtoSchema))
    complete2FAEnrollmentDto: Complete2FAEnrollmentDto,
    @Req() req: Request & { apiVersion?: string },
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const apiVersion = this.getApiVersion(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.completeTwoFactorEnrollment(
      this.extractTwoFactorEnrollmentToken(req) || '',
      complete2FAEnrollmentDto,
      ip,
      userAgent,
    );

    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.accessTokenExpiresAt,
      result.refreshTokenExpiresAt,
    );

    if (result.trustedDeviceToken && result.trustedDeviceExpiresAt) {
      this.setTrustedDeviceCookie(res, result.trustedDeviceToken, result.trustedDeviceExpiresAt);
    }

    this.clearTwoFactorEnrollmentCookie(res);
    return assertContractResponse(
      authAuthenticatedResponseSchemasByVersion[apiVersion],
      this.buildAuthenticatedResponse(result, apiVersion),
      authPaths.twoFactorEnrollmentEnable,
    );
  }

  /**
   * GET /auth/2fa/generate
   * Gerar QR Code para 2FA do usuario autenticado.
   */
  @Get('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async generate2FA(@Req() req: AuthenticatedRequest, @Ip() ip: string) {
    return assertContractResponse(
      authTwoFactorSecretResponseSchema,
      await this.twoFactorService.generateSecret(req.user.id, {
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        ipAddress: ip,
        userAgent: this.resolveUserAgent(req),
      }),
      authPaths.twoFactorGenerate,
    );
  }

  /**
   * POST /auth/2fa/enable
   * Ativar 2FA
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async enable2FA(
    @Body(new ZodValidationPipe(verify2FADtoSchema)) verify2FADto: Verify2FADto,
    @Req() req: AuthenticatedRequest,
    @Ip() ip: string,
  ) {
    return assertContractResponse(
      authMessageResponseSchema,
      await this.twoFactorService.enable(req.user.id, verify2FADto.token, {
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        ipAddress: ip,
        userAgent: this.resolveUserAgent(req),
      }),
      authPaths.twoFactorEnable,
    );
  }

  /**
   * POST /auth/2fa/disable
   * Desativar 2FA
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async disable2FA(
    @Body(new ZodValidationPipe(verify2FADtoSchema)) verify2FADto: Verify2FADto,
    @Req() req: AuthenticatedRequest,
    @Ip() ip: string,
  ) {
    return assertContractResponse(
      authMessageResponseSchema,
      await this.twoFactorService.disable(req.user.id, verify2FADto.token, {
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        ipAddress: ip,
        userAgent: this.resolveUserAgent(req),
      }),
      authPaths.twoFactorDisable,
    );
  }

  /**
   * GET /auth/2fa/status
   * Verificar status de 2FA do usuario logado
   */
  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Req() req: AuthenticatedRequest) {
    const user = await this.authService.getProfile(req.user.id);
    const policy = await this.securityConfigService.getTwoFactorConfig();
    return assertContractResponse(
      authTwoFactorStatusResponseSchema,
      {
        enabled: user.twoFactorEnabled || false,
        globallyEnabled: policy.enabled === true,
        required: policy.required === true,
        requiredForAdmins: policy.requiredForAdmins === true,
        suggested: policy.suggested !== false,
      },
      authPaths.twoFactorStatus,
    );
  }

  /**
   * GET /auth/me
   * Retornar dados do usuario logado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: AuthenticatedRequest) {
    const apiVersion = this.getApiVersion(req);
    return assertContractResponse(
      authUserSchemasByVersion[apiVersion],
      this.projectUserForVersion(await this.authService.getProfile(req.user.id), apiVersion),
      authPaths.me,
    );
  }

  /**
   * POST /auth/email/send-verification
   * Enviar email de verificacao
   */
  @Post('email/send-verification')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async sendVerificationEmail(@Req() req: AuthenticatedRequest) {
    return this.emailVerificationService.sendVerificationEmail(req.user.id);
  }

  /**
   * POST /auth/email/verify
   * Verificar email com token
   * CSRF: Desabilitado - endpoint publico
   */
  @SkipCsrf()
  @Post('email/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailDtoSchema)) verifyEmailDto: VerifyEmailDto,
  ) {
    return assertContractResponse(
      authMessageResponseSchema,
      await this.emailVerificationService.verifyEmail(verifyEmailDto.token),
      authPaths.emailVerify,
    );
  }

  /**
   * GET /auth/email/status
   * Verificar status de verificacao de email
   */
  @Get('email/status')
  @UseGuards(JwtAuthGuard)
  async checkEmailVerification(@Req() req: AuthenticatedRequest) {
    return this.emailVerificationService.checkEmailVerification(req.user.id);
  }

  /**
   * POST /auth/forgot-password
   * Solicitar recuperacao de senha
   * CSRF: Desabilitado - endpoint publico
   */
  @SkipCsrf()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordDtoSchema)) forgotPasswordDto: ForgotPasswordDto,
  ) {
    return assertContractResponse(
      authMessageResponseSchema,
      await this.passwordResetService.requestPasswordReset(forgotPasswordDto.email),
      authPaths.forgotPassword,
    );
  }

  /**
   * POST /auth/reset-password
   * Redefinir senha com token
   * CSRF: Desabilitado - endpoint publico
   */
  @SkipCsrf()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordDtoSchema)) resetPasswordDto: ResetPasswordDto,
  ) {
    return assertContractResponse(
      authMessageResponseSchema,
      await this.passwordResetService.resetPassword(
        resetPasswordDto.token,
        resetPasswordDto.newPassword,
      ),
      authPaths.resetPassword,
    );
  }

  private finalizeAuthFlowResponse(
    result: LoginFlowResponse,
    res: Response,
    apiVersion: ApiVersion,
  ) {
    if (result.status === 'AUTHENTICATED') {
      this.setAuthCookies(
        res,
        result.accessToken,
        result.refreshToken,
        result.accessTokenExpiresAt,
        result.refreshTokenExpiresAt,
      );
      this.clearTwoFactorEnrollmentCookie(res);
      return this.buildAuthenticatedResponse(result, apiVersion);
    }

    if (result.status === 'REQUIRES_TWO_FACTOR') {
      if (result.clearTrustedDeviceCookie) {
        this.clearTrustedDeviceCookie(res);
      }
      res.status(HttpStatus.ACCEPTED);
      return {
        status: result.status,
        authenticated: false,
        requiresTwoFactor: true,
        mustEnrollTwoFactor: false,
      };
    }

    this.setTwoFactorEnrollmentCookie(res, result.enrollmentToken, result.enrollmentExpiresAt);
    res.status(HttpStatus.ACCEPTED);
    return {
      status: result.status,
      authenticated: false,
      requiresTwoFactor: false,
      mustEnrollTwoFactor: true,
      enrollmentExpiresAt: result.enrollmentExpiresAt,
    };
  }

  private buildAuthenticatedResponse(result: {
    status: 'AUTHENTICATED';
    authenticated: true;
    requiresTwoFactor: false;
    mustEnrollTwoFactor: false;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string;
    user: unknown;
  }, apiVersion: ApiVersion) {
    return {
      status: result.status,
      authenticated: result.authenticated,
      requiresTwoFactor: result.requiresTwoFactor,
      mustEnrollTwoFactor: result.mustEnrollTwoFactor,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      user: this.projectUserForVersion(result.user, apiVersion),
    };
  }

  private projectUserForVersion(user: unknown, apiVersion: ApiVersion) {
    if (apiVersion !== '1' || !user || typeof user !== 'object' || Array.isArray(user)) {
      return user;
    }

    const { preferences: _preferences, ...legacyUser } = user as Record<string, unknown>;
    return legacyUser;
  }

  private rethrowAuthContractError(error: unknown): never {
    if (error instanceof UnauthorizedException) {
      const authCode = (error as AuthErrorWithCode).authCode || 'AUTHENTICATION_FAILED';
      const errorResponse = error.getResponse();
      const message =
        typeof errorResponse === 'string'
          ? errorResponse
          : typeof (errorResponse as { message?: unknown })?.message === 'string'
            ? String((errorResponse as { message?: unknown }).message)
            : error.message;

      throw new UnauthorizedException({
        status:
          authCode === 'INVALID_CREDENTIALS'
            ? 'INVALID_CREDENTIALS'
            : authCode === 'ACCOUNT_LOCKED'
              ? 'ACCOUNT_LOCKED'
              : 'AUTHENTICATION_FAILED',
        code: authCode,
        invalidCredentials: authCode === 'INVALID_CREDENTIALS',
        message,
      });
    }

    throw error;
  }

  private extractTrustedDeviceToken(req: Request): string | undefined {
    const cookieValue = req.cookies?.[TRUSTED_DEVICE_COOKIE_NAME];
    if (typeof cookieValue !== 'string') {
      return undefined;
    }

    const token = cookieValue.trim();
    return token.length > 0 ? token : undefined;
  }

  private extractTwoFactorEnrollmentToken(req: Request): string | undefined {
    const cookieValue = req.cookies?.[TWO_FACTOR_ENROLLMENT_COOKIE_NAME];
    if (typeof cookieValue !== 'string') {
      return undefined;
    }

    const token = cookieValue.trim();
    return token.length > 0 ? token : undefined;
  }

  private extractRefreshToken(req: Request): string | undefined {
    const cookieValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (typeof cookieValue !== 'string') {
      return undefined;
    }

    const token = cookieValue.trim();
    return token.length > 0 ? token : undefined;
  }

  private extractAccessToken(req: Request): string | undefined {
    return this.extractBearerToken(req) || this.extractAccessTokenCookie(req);
  }

  private extractAccessTokenCookie(req: Request): string | undefined {
    const cookieValue = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
    if (typeof cookieValue !== 'string') {
      return undefined;
    }

    const token = cookieValue.trim();
    return token.length > 0 ? token : undefined;
  }

  private extractBearerToken(req: Request): string | undefined {
    const authorization = req.headers['authorization'];
    const headerValue = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!headerValue) {
      return undefined;
    }

    const [scheme, token] = headerValue.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token.trim();
  }

  private setTrustedDeviceCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(TRUSTED_DEVICE_COOKIE_NAME, token, buildTrustedDeviceCookieOptions(expiresAt));
  }

  private clearTrustedDeviceCookie(res: Response): void {
    res.cookie(TRUSTED_DEVICE_COOKIE_NAME, '', buildTrustedDeviceCookieClearOptions());
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    accessTokenExpiresAt: string | null,
    refreshTokenExpiresAt: string,
  ): void {
    const accessExpiresAt = this.parseExpiresAt(accessTokenExpiresAt, 15);
    const refreshExpiresAt = this.parseExpiresAt(refreshTokenExpiresAt, 7 * 24 * 60);

    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      accessToken,
      buildAccessTokenCookieOptions(accessExpiresAt),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      buildRefreshTokenCookieOptions(refreshExpiresAt),
    );
  }

  private clearAuthCookies(res: Response): void {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, '', buildAuthCookieClearOptions());
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, '', buildAuthCookieClearOptions());
  }

  private setTwoFactorEnrollmentCookie(
    res: Response,
    token: string,
    expiresAtIso: string,
  ): void {
    const expiresAt = this.parseExpiresAt(expiresAtIso, 10);
    res.cookie(
      TWO_FACTOR_ENROLLMENT_COOKIE_NAME,
      token,
      buildTwoFactorEnrollmentCookieOptions(expiresAt),
    );
  }

  private clearTwoFactorEnrollmentCookie(res: Response): void {
    res.cookie(TWO_FACTOR_ENROLLMENT_COOKIE_NAME, '', buildAuthCookieClearOptions());
  }

  private parseExpiresAt(expiresAt: string | null | undefined, fallbackMinutes: number): Date {
    const parsed = expiresAt ? new Date(expiresAt) : new Date(NaN);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return new Date(Date.now() + fallbackMinutes * 60 * 1000);
  }

  private resolveUserAgent(req: Request): string | undefined {
    const header = req.headers['user-agent'];
    const userAgent = Array.isArray(header) ? header[0] : header;
    return typeof userAgent === 'string' && userAgent.trim().length > 0
      ? userAgent.trim()
      : undefined;
  }

  private getApiVersion(req: { apiVersion?: string }): ApiVersion {
    return req.apiVersion === '1' || req.apiVersion === '2' ? req.apiVersion : API_CURRENT_VERSION;
  }
}
