import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get('websocket')
  async websocketHealth() {
    try {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        redisConfigured: Boolean(process.env.REDIS_HOST),
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'health_check_failed',
      };
    }
  }

  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
    };
  }

  @Get('ping')
  ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}
