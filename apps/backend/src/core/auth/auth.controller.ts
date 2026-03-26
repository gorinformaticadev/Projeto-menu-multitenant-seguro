import { Controller, Post, Body, Ip, UseGuards, Get, Req } from '@nestjs/common';
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
import {
  LoginResponseDto,
  LogoutResponseDto,
  TwoFactorGenerateResponseDto,
  TwoFactorStatusResponseDto,
  AuthUserResponseDto,
  EmailVerificationStatusResponseDto,
  SimpleMessageResponseDto,
} from './dto/auth-response.dto';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { SkipCsrf } from '@core/common/decorators/skip-csrf.decorator';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    private emailVerificationService: EmailVerificationService,
    private passwordResetService: PasswordResetService,
  ) { }

  /**
   * POST /auth/login
   * Rate Limiting: 5 tentativas por minuto
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login')
  @ValidateResponse(LoginResponseDto)
  @Throttle({ login: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(loginDto, ip, userAgent) as any;
  }

  /**
   * POST /auth/refresh
   * Renovar access token usando refresh token
   * CSRF: Desabilitado - usa refresh token como autenticação
   */
  @SkipCsrf()
  @Post('refresh')
  @ValidateResponse(LoginResponseDto)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas por minuto
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.refreshTokens(refreshTokenDto.refreshToken, ip, userAgent) as any;
  }

  /**
   * POST /auth/logout
   * Invalidar refresh token
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(LogoutResponseDto)
  async logout(
    @Body() logoutDto: LogoutDto,
    @Req() req: AuthenticatedRequest,
    @Ip() ip: string,
  ): Promise<LogoutResponseDto> {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.logout(logoutDto.refreshToken, req.user.id, ip, userAgent) as any;
  }

  /**
   * POST /auth/login-2fa
   * Login com 2FA
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login-2fa')
  @ValidateResponse(LoginResponseDto)
  @Throttle({ login: { limit: 5, ttl: 60000 } })
  async login2FA(
    @Body() login2FADto: Login2FADto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login2FA(login2FADto, ip, userAgent) as any;
  }

  /**
   * GET /auth/2fa/generate
   * Gerar QR Code para 2FA
   */
  @Get('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(TwoFactorGenerateResponseDto)
  async generate2FA(@Req() req: AuthenticatedRequest): Promise<TwoFactorGenerateResponseDto> {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  /**
   * POST /auth/2fa/enable
   * Ativar 2FA
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(SimpleMessageResponseDto)
  async enable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: AuthenticatedRequest): Promise<SimpleMessageResponseDto> {
    return this.twoFactorService.enable(req.user.id, verify2FADto.token) as any;
  }

  /**
   * POST /auth/2fa/disable
   * Desativar 2FA
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(SimpleMessageResponseDto)
  async disable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: AuthenticatedRequest): Promise<SimpleMessageResponseDto> {
    return this.twoFactorService.disable(req.user.id, verify2FADto.token) as any;
  }
  /**
   * GET /auth/2fa/status
   * Verificar status de 2FA do usuário logado
   */
  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(TwoFactorStatusResponseDto)
  async get2FAStatus(@Req() req: AuthenticatedRequest): Promise<TwoFactorStatusResponseDto> {
    const user = await this.authService.getProfile(req.user.id);
    return {
      enabled: user.twoFactorEnabled || false,
      suggested: true, // Esta informação virá da configuração de segurança
    };
  }

  /**
   * GET /auth/me
   * Retornar dados do usuário logado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(AuthUserResponseDto)
  async getProfile(@Req() req: AuthenticatedRequest): Promise<AuthUserResponseDto> {
    return this.authService.getProfile(req.user.id) as any;
  }

  /**
   * POST /auth/email/send-verification
   * Enviar email de verificação
   */
  @Post('email/send-verification')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(SimpleMessageResponseDto)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  async sendVerificationEmail(@Req() req: AuthenticatedRequest): Promise<SimpleMessageResponseDto> {
    return this.emailVerificationService.sendVerificationEmail(req.user.id) as any;
  }

  /**
   * POST /auth/email/verify
   * Verificar email com token
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('email/verify')
  @ValidateResponse(SimpleMessageResponseDto)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas por minuto
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<SimpleMessageResponseDto> {
    return this.emailVerificationService.verifyEmail(verifyEmailDto.token) as any;
  }

  /**
   * GET /auth/email/status
   * Verificar status de verificação de email
   */
  @Get('email/status')
  @UseGuards(JwtAuthGuard)
  @ValidateResponse(EmailVerificationStatusResponseDto)
  async checkEmailVerification(@Req() req: AuthenticatedRequest): Promise<EmailVerificationStatusResponseDto> {
    const result = await this.emailVerificationService.checkEmailVerification(req.user.id);
    return {
      isVerified: result.verified,
      verified: result.verified,
      verifiedAt: result.verifiedAt ? result.verifiedAt.toISOString() : null,
    };
  }

  /**
   * POST /auth/forgot-password
   * Solicitar recuperação de senha
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('forgot-password')
  @ValidateResponse(SimpleMessageResponseDto)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 tentativas por hora
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<SimpleMessageResponseDto> {
    return this.passwordResetService.requestPasswordReset(forgotPasswordDto.email) as any;
  }

  /**
   * POST /auth/reset-password
   * Redefinir senha com token
   * CSRF: Desabilitado - endpoint público
   */
  @SkipCsrf()
  @Post('reset-password')
  @ValidateResponse(SimpleMessageResponseDto)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 tentativas por hora
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<SimpleMessageResponseDto> {
    return this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    ) as any;
  }
}
