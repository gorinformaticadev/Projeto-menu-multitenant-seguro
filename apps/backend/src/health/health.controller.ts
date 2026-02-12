import { Controller, Get, Head, SetMetadata } from '@nestjs/common';

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
