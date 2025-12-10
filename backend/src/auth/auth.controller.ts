import { Controller, Post, Body, Req, Ip, UseGuards, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  /**
   * POST /auth/login
   * Rate Limiting: 5 tentativas por minuto
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login')
  @Throttle({ login: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(loginDto, ip, userAgent);
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
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.logout(logoutDto.refreshToken, req.user.id, ip, userAgent);
  }

  /**
   * POST /auth/login-2fa
   * Login com 2FA
   * CSRF: Desabilitado - endpoint público de autenticação
   */
  @SkipCsrf()
  @Post('login-2fa')
  @Throttle({ login: { limit: 5, ttl: 60000 } })
  async login2FA(
    @Body() login2FADto: Login2FADto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login2FA(login2FADto, ip, userAgent);
  }

  /**
   * GET /auth/2fa/generate
   * Gerar QR Code para 2FA
   */
  @Get('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async generate2FA(@Req() req: any) {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  /**
   * POST /auth/2fa/enable
   * Ativar 2FA
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: any) {
    return this.twoFactorService.enable(req.user.id, verify2FADto.token);
  }

  /**
   * POST /auth/2fa/disable
   * Desativar 2FA
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(@Body() verify2FADto: Verify2FADto, @Req() req: any) {
    return this.twoFactorService.disable(req.user.id, verify2FADto.token);
  }
  /**
   * GET /auth/me
   * Retornar dados do usuário logado
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }
}
