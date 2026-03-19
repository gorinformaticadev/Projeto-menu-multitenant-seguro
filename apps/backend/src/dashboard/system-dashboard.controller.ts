import { Body, Controller, Get, Put, Query, Request, UseGuards } from '@nestjs/common';
import {
  dashboardLayoutResponseSchema,
  dashboardModuleCardsResponseSchema,
  dashboardPaths,
  systemDashboardResponseSchemasByVersion,
} from '@contracts/dashboard';
import { API_CURRENT_VERSION, type ApiVersion } from '@contracts/http';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { assertContractResponse } from '../common/contracts/contract-response.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type SystemDashboardQueryDto,
  type UpdateSystemDashboardLayoutDto,
  systemDashboardQueryDtoSchema,
  updateSystemDashboardLayoutDtoSchema,
} from './dto/system-dashboard.dto';
import { assertRuntimeSystemDashboardContract } from './system-dashboard.runtime-contract';
import { DashboardActor, DashboardModuleCardsResponse, SystemDashboardService } from './system-dashboard.service';

type DashboardRequestUser = {
  id?: string;
  sub?: string;
  role?: string;
  tenantId?: string | null;
  name?: string | null;
  email?: string | null;
  tenantName?: string | null;
  tenant?: {
    nomeFantasia?: string | null;
  } | null;
};

type DashboardRequest = {
  user?: DashboardRequestUser;
  apiVersion?: string;
};

@Controller('system/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
export class SystemDashboardController {
  constructor(private readonly dashboardService: SystemDashboardService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  async getDashboard(
    @Request() req: DashboardRequest,
    @Query(new ZodValidationPipe(systemDashboardQueryDtoSchema)) query: SystemDashboardQueryDto,
  ) {
    const apiVersion = this.getApiVersion(req);
    return assertContractResponse(
      systemDashboardResponseSchemasByVersion[apiVersion],
      await this.dashboardService.getDashboard(this.getActor(req), {
        periodMinutes: query.periodMinutes,
        tenantId: query.tenantId,
        severity: query.severity,
      }, apiVersion),
      dashboardPaths.aggregate,
      {
        productionValidator: (value) => {
          assertRuntimeSystemDashboardContract(value, apiVersion);
        },
      },
    );
  }

  @Get('module-cards')
  async getModuleCards(@Request() req: DashboardRequest): Promise<DashboardModuleCardsResponse> {
    return assertContractResponse(
      dashboardModuleCardsResponseSchema,
      await this.dashboardService.getModuleCards(this.getActor(req)),
      dashboardPaths.moduleCards,
    );
  }

  @Get('layout')
  async getLayout(@Request() req: DashboardRequest) {
    return assertContractResponse(
      dashboardLayoutResponseSchema,
      await this.dashboardService.getLayout(this.getActor(req)),
      dashboardPaths.layout,
    );
  }

  @Put('layout')
  async saveLayout(
    @Request() req: DashboardRequest,
    @Body(new ZodValidationPipe(updateSystemDashboardLayoutDtoSchema))
    body: UpdateSystemDashboardLayoutDto,
  ) {
    return assertContractResponse(
      dashboardLayoutResponseSchema,
      await this.dashboardService.saveLayout(this.getActor(req), {
        layoutJson: body?.layoutJson,
        filtersJson: body?.filtersJson,
      }),
      dashboardPaths.layout,
    );
  }

  private getActor(req: DashboardRequest): DashboardActor {
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

  private getApiVersion(req: DashboardRequest): ApiVersion {
    return req.apiVersion === '1' || req.apiVersion === '2' ? req.apiVersion : API_CURRENT_VERSION;
  }
}
