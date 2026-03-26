import { Controller, Get } from '@nestjs/common';
import { Public } from '@core/decorators/public.decorator';
import { MaintenanceModeService } from './maintenance-mode.service';
import { MaintenanceStateDto } from './dto/maintenance-state.dto';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';

@Controller('system/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceModeService: MaintenanceModeService) {}

  @Public()
  @ValidateResponse(MaintenanceStateDto)
  @Get('state')
  async getState(): Promise<MaintenanceStateDto> {
    return await this.maintenanceModeService.getState();
  }
}
