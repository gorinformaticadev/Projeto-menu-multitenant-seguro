import { Controller, Get } from '@nestjs/common';
import { Public } from '@core/decorators/public.decorator';
import { MaintenanceModeService } from './maintenance-mode.service';

@Controller('system/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceModeService: MaintenanceModeService) {}

  @Public()
  @Get('state')
  async getState() {
    return {
      success: true,
      data: await this.maintenanceModeService.getState(),
    };
  }
}
