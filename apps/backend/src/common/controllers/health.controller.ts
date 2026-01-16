import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor() { }

  @Get('websocket')
  async websocketHealth() {
    try {
      // Verificar conectividade Redis (se configurado)
      const redisStatus = process.env.REDIS_HOST ? 'configured' : 'not_configured';

      // Métricas básicas do processo
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime,
        redis: redisStatus,
        memoryUsage,
        pid: process.pid,
        nodeVersion: process.version
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'multitenant-backend'
    };
  }

  @Get('ping')
  ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString()
    };
  }
}