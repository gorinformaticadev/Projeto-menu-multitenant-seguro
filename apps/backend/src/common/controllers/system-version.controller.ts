import { Controller, Get } from '@nestjs/common';
import { SystemVersionService } from '../services/system-version.service';

@Controller('system')
export class SystemVersionController {
  constructor(private readonly systemVersionService: SystemVersionService) {}

  @Get('version')
  getVersion() {
    return this.systemVersionService.getVersionInfo();
  }
}
