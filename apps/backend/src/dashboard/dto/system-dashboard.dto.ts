import {
  systemDashboardSeveritySchema,
  systemDashboardQuerySchema,
  updateSystemDashboardLayoutBodySchema,
  type SystemDashboardQuery,
  type SystemDashboardSeverity,
  type UpdateSystemDashboardLayoutBody,
} from '@contracts/dashboard';

export type SystemDashboardQueryDto = SystemDashboardQuery;
export type UpdateSystemDashboardLayoutDto = UpdateSystemDashboardLayoutBody;
export type { SystemDashboardSeverity };

export const systemDashboardSeverityDtoSchema = systemDashboardSeveritySchema;
export const systemDashboardQueryDtoSchema = systemDashboardQuerySchema;
export const updateSystemDashboardLayoutDtoSchema = updateSystemDashboardLayoutBodySchema;
