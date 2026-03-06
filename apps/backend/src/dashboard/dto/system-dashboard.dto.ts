export class SystemDashboardQueryDto {
  periodMinutes?: string;
  tenantId?: string;
  severity?: string;
}

export class UpdateSystemDashboardLayoutDto {
  layoutJson?: unknown;
  filtersJson?: unknown;
}
