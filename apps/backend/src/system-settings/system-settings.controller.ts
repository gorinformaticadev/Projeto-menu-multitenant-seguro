import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemSettingsReadService } from './system-settings-read.service';

@Controller('system/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemSettingsController {
  constructor(private readonly systemSettingsReadService: SystemSettingsReadService) {}

  @Get('panel')
  async listPanelSettings() {
    return this.systemSettingsReadService.listPanelSettings();
  }
}
