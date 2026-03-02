import { Controller, Get } from '@nestjs/common';
import { resolveAppVersionTag } from '../utils/app-version.util';

@Controller('system')
export class SystemVersionController {
  @Get('version')
  getVersion() {
    return {
      version: resolveAppVersionTag(),
      commit: process.env.GIT_SHA || undefined,
      buildTime: process.env.BUILD_TIME || undefined,
    };
  }
}
