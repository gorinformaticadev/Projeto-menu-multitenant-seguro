import { Controller, Get, Head } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }

  @Head()
  checkHead() {
    return { status: 'ok' };
  }
}
