import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthCheckController {
  @Get()
  healthCheck() {
    return { 
      status: 'ok', 
      timestamp: new Date(),
      message: 'Sistema está funcionando corretamente com a nova arquitetura modular'
    };
  }
}