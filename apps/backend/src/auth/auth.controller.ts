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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { SkipCsrf } from '@core/common/decorators/skip-csrf.decorator';
import { Request, Response } from 'express';
import {
  TRUSTED_DEVICE_COOKIE_NAME,
  buildTrustedDeviceCookieClearOptions,
  buildTrustedDeviceCookieOptions,
} from './trusted-device.constants';
import { TwoFactorRequiredException } from './exceptions/two-factor-required.exception';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    private emailVerificationService: EmailVerificationService,
    private passwordResetService: PasswordResetService,
    private securityConfigService: SecurityConfigService,
  ) { }

  /**
   * POST /auth/login
   * Rate Limiting: 5 tentativas por minuto
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const trustedDeviceToken = this.extractTrustedDeviceToken(req);

    try {
      return await this.authService.login(loginDto, ip, userAgent, trustedDeviceToken);
    } catch (error) {
      if (error instanceof TwoFactorRequiredException) {
        if (error.clearTrustedDeviceCookie) {
          this.clearTrustedDeviceCookie(res);
        }

        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  /**
   * POST /auth/refresh
   * Renovar access token usando refresh token
   * CSRF: Desabilitado - usa refresh token como autenticação
   */
  @SkipCsrf()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas por minuto
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.refreshTokens(refreshTokenDto.refreshToken, ip, userAgent);
  }

  /**
   * POST /auth/logout
   * Invalidar refresh token
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() logoutDto: LogoutDto,
    @Req() req: AuthenticatedRequest,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.logout(
      logoutDto.refreshToken,
      req.user.id,
      this.extractBearerToken(req),
      ip,
      userAgent,
    );
  }

  /**
   * POST /auth/login-2fa
   * Login com 2FA
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login-2fa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login2FA(
    @Body() login2FADto: Login2FADto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.login2FA(login2FADto, ip, userAgent);

    if (result.trustedDeviceToken && result.trustedDeviceExpiresAt) {
      this.setTrustedDeviceCookie(res, result.trustedDeviceToken, result.trustedDeviceExpiresAt);
    }

    const responseBody = { ...result } as Record<string, unknown>;
    delete responseBody.trustedDeviceToken;
    delete responseBody.trustedDeviceExpiresAt;
    return responseBody;
  }

  /**
   * GET /auth/2fa/generate
   * Gerar QR Code para 2FA
   */
  @Get('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async generate2FA(@Req() req: AuthenticatedRequest) {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  /**
   * POST /auth/2fa/enable
   * Ativar 2FA
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: AuthenticatedRequest) {
    return this.twoFactorService.enable(req.user.id, verify2FADto.token);
  }

  /**
   * POST /auth/2fa/disable
   * Desativar 2FA
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: AuthenticatedRequest) {
    return this.twoFactorService.disable(req.user.id, verify2FADto.token);
  }
  /**
   * GET /auth/2fa/status
   * Verificar status de 2FA do usuário logado
   */
  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Req() req: AuthenticatedRequest) {
    const user = await this.authService.getProfile(req.user.id);
    const policy = await this.securityConfigService.getTwoFactorConfig();
    return {
      enabled: user.twoFactorEnabled || false,
      globallyEnabled: policy.enabled === true,
      required: policy.required === true,
      requiredForAdmins: policy.requiredForAdmins === true,
      suggested: policy.suggested !== false,
    };
  }

  /**
   * GET /auth/me
   * Retornar dados do usuário logado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * POST /auth/email/send-verification
   * Enviar email de verificação
   */
  @Post('email/send-verification')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  async sendVerificationEmail(@Req() req: AuthenticatedRequest) {
    return this.emailVerificationService.sendVerificationEmail(req.user.id);
  }

  /**
   * POST /auth/email/verify
   * Verificar email com token
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('email/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas por minuto
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.emailVerificationService.verifyEmail(verifyEmailDto.token);
  }

  /**
   * GET /auth/email/status
   * Verificar status de verificação de email
   */
  @Get('email/status')
  @UseGuards(JwtAuthGuard)
  async checkEmailVerification(@Req() req: AuthenticatedRequest) {
    return this.emailVerificationService.checkEmailVerification(req.user.id);
  }

  /**
   * POST /auth/forgot-password
   * Solicitar recuperação de senha
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.passwordResetService.requestPasswordReset(forgotPasswordDto.email);
  }

  /**
   * POST /auth/reset-password
   * Redefinir senha com token
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 tentativas por hora
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    );
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

  private extractTrustedDeviceToken(req: Request): string | undefined {
    const cookieValue = req.cookies?.[TRUSTED_DEVICE_COOKIE_NAME];
    if (typeof cookieValue !== 'string') {
      return undefined;
    }

    const token = cookieValue.trim();
    return token.length > 0 ? token : undefined;
  }

  private setTrustedDeviceCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(TRUSTED_DEVICE_COOKIE_NAME, token, buildTrustedDeviceCookieOptions(expiresAt));
  }

  private clearTrustedDeviceCookie(res: Response): void {
    res.cookie(TRUSTED_DEVICE_COOKIE_NAME, '', buildTrustedDeviceCookieClearOptions());
  }
}
