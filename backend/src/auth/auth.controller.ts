import { Controller, Post, Body, Req, Ip } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
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
}
