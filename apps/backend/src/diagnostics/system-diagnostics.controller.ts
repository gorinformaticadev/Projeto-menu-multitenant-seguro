import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import { DashboardActor } from '../dashboard/system-dashboard.service';
import { SystemDiagnosticsService } from './system-diagnostics.service';
import { SystemDiagnosticsResponseDto } from './dto/system-diagnostics-response.dto';

@Controller('system/diagnostics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemDiagnosticsController {
  constructor(private readonly diagnosticsService: SystemDiagnosticsService) {}

  @Get()
  @ValidateResponse(SystemDiagnosticsResponseDto)
  async getDiagnostics(@Request() req: any): Promise<SystemDiagnosticsResponseDto> {
    return this.diagnosticsService.getDiagnostics(this.getActor(req)) as unknown as SystemDiagnosticsResponseDto;
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
