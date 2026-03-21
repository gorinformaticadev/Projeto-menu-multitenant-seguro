import { IsOptional, IsString } from 'class-validator';

export class SystemDashboardQueryDto {
  @IsOptional()
  @IsString()
  periodMinutes?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  severity?: string;
}

export class UpdateSystemDashboardLayoutDto {
  @IsOptional()
  layoutJson?: unknown;

  @IsOptional()
  filtersJson?: unknown;
}
