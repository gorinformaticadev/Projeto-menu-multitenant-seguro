import { Controller, Post, Body, Req, Ip, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/login
   * Rate Limiting: 5 tentativas por minuto
   */
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
   */
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
}
