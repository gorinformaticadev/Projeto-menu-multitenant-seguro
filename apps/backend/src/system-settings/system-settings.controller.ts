import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@core/common/decorators/current-user.decorator';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import {
  RestoreSystemSettingFallbackDto,
  UpdateSystemSettingDto,
} from './dto/system-settings-write.dto';
import { SystemSettingsReadService } from './system-settings-read.service';
import { SystemSettingsWriteService } from './system-settings-write.service';

type AuthenticatedSystemSettingsUser = {
  id?: string;
  sub?: string;
  email?: string | null;
  role: Role;
};

@Controller('system/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemSettingsController {
  constructor(
    private readonly systemSettingsReadService: SystemSettingsReadService,
    private readonly systemSettingsWriteService: SystemSettingsWriteService,
  ) {}

  @Get('panel')
  async listPanelSettings() {
    return this.systemSettingsReadService.listPanelSettings();
  }

  @Put('panel/:key')
  async updatePanelSetting(
    @Param('key') key: string,
    @Body() body: UpdateSystemSettingDto,
    @CurrentUser() user: AuthenticatedSystemSettingsUser,
  ) {
    return this.systemSettingsWriteService.updatePanelSetting(
      key,
      body.value,
      {
        userId: user?.id ?? user?.sub ?? null,
        email: user?.email ?? null,
      },
      body.changeReason,
    );
  }

  @Post('panel/:key/restore-fallback')
  @HttpCode(HttpStatus.OK)
  async restorePanelSettingFallback(
    @Param('key') key: string,
    @Body() body: RestoreSystemSettingFallbackDto,
    @CurrentUser() user: AuthenticatedSystemSettingsUser,
  ) {
    return this.systemSettingsWriteService.restorePanelSettingFallback(
      key,
      {
        userId: user?.id ?? user?.sub ?? null,
        email: user?.email ?? null,
      },
      body.changeReason,
    );
  }
}
