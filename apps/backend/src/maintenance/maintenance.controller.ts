import { Controller, Get } from '@nestjs/common';
import { Public } from '@core/decorators/public.decorator';
import { MaintenanceModeService } from './maintenance-mode.service';

@Controller('system/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceModeService: MaintenanceModeService) {}

  @Public()
  @Get('state')
  async getState() {
    const state = await this.maintenanceModeService.getState();
    return {
      enabled: state.enabled,
      etaSeconds: state.etaSeconds,
    };
  }
}
