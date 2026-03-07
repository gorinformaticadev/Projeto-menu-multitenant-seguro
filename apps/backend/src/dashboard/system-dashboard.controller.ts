import { Body, Controller, Get, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemDashboardQueryDto, UpdateSystemDashboardLayoutDto } from './dto/system-dashboard.dto';
import { DashboardActor, DashboardModuleCardsResponse, SystemDashboardService } from './system-dashboard.service';

@Controller('system/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
export class SystemDashboardController {
  constructor(private readonly dashboardService: SystemDashboardService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  async getDashboard(@Request() req: any, @Query() query: SystemDashboardQueryDto) {
    return this.dashboardService.getDashboard(this.getActor(req), {
      periodMinutes: this.parsePositiveInt(query.periodMinutes),
      tenantId: query.tenantId,
      severity: query.severity,
    });
  }

  @Get('module-cards')
  async getModuleCards(@Request() req: any): Promise<DashboardModuleCardsResponse> {
    return this.dashboardService.getModuleCards(this.getActor(req));
  }

  @Get('layout')
  async getLayout(@Request() req: any) {
    return this.dashboardService.getLayout(this.getActor(req));
  }

  @Put('layout')
  async saveLayout(@Request() req: any, @Body() body: UpdateSystemDashboardLayoutDto) {
    return this.dashboardService.saveLayout(this.getActor(req), {
      layoutJson: body?.layoutJson,
      filtersJson: body?.filtersJson,
    });
  }

  private parsePositiveInt(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }

  private getActor(req: any): DashboardActor {
    const roleRaw = String(req?.user?.role || '').trim().toUpperCase();
    const roleValues = new Set(Object.values(Role));
    const role = roleValues.has(roleRaw as Role) ? (roleRaw as Role) : Role.USER;
    const userId = String(req?.user?.id || req?.user?.sub || '').trim();
    const tenantId = String(req?.user?.tenantId || '').trim() || null;
    const name = String(req?.user?.name || '').trim() || null;
    const email = String(req?.user?.email || '').trim() || null;
    const tenantName = String(req?.user?.tenant?.nomeFantasia || req?.user?.tenantName || '').trim() || null;

    return {
      userId,
      role,
      tenantId,
      name,
      email,
      tenantName,
    };
  }
}
