import { Controller, Get } from '@nestjs/common';
import { SystemVersionService } from '../services/system-version.service';
import { ValidateResponse } from '../decorators/validate-response.decorator';
import { SystemVersionResponseDto } from '../dto/system-version-response.dto';

@Controller('system')
export class SystemVersionController {
  constructor(private readonly systemVersionService: SystemVersionService) {}

  @Get('version')
  @ValidateResponse(SystemVersionResponseDto)
  getVersion(): SystemVersionResponseDto {
    const info = this.systemVersionService.getVersionInfo();
    return {
      version: info.version,
      source: info.source,
    };
  }
}
