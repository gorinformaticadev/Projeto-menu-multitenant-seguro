import { Controller, Get, Head, SetMetadata } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
@SetMetadata('skipCsrf', true)
@SetMetadata('isPublic', true)
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
