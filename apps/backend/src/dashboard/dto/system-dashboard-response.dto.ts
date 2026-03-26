import { IsString, IsNumber, IsBoolean, IsOptional, IsObject, IsArray, IsEnum, ValidateNested, IsDateString } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class DashboardMetricStatusDto {
  @ApiProperty({ enum: ['ok', 'warning', 'error', 'degraded', 'unavailable', 'healthy', 'down', 'not_configured', 'restricted'] })
  @Expose()
  @IsEnum(['ok', 'warning', 'error', 'degraded', 'unavailable', 'healthy', 'down', 'not_configured', 'restricted'])
  status: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  error?: string;
}

export class DashboardVersionDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  commitSha?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  buildDate?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  source?: string;
}

export class DashboardMaintenanceDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  etaSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  startedAt?: string;
}

export class DashboardSystemDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  release?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  arch?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  nodeVersion?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  pid?: number;
}

export class DashboardCpuDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  cores?: number;

  @ApiProperty({ required: false, type: [Number] })
  @Expose()
  @IsOptional()
  @IsArray()
  loadAvg?: number[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  usagePercent?: number | null;
}

export class MemoryHistoryEntryDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  recordedAt: number;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  usedPercent: number | null;

  @ApiProperty()
  @Expose()
  @IsNumber()
  rssBytes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  heapUsedBytes: number;
}

export class MemoryProcessDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  rssBytes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  heapTotalBytes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  heapUsedBytes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  externalBytes: number;
}

export class DashboardMemoryDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalBytes?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  freeBytes?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  usedBytes?: number;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  usedPercent?: number | null;

  @ApiProperty({ required: false, type: MemoryProcessDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => MemoryProcessDto)
  process?: MemoryProcessDto;

  @ApiProperty({ required: false, type: [MemoryHistoryEntryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemoryHistoryEntryDto)
  history?: MemoryHistoryEntryDto[];
}

export class DashboardDiskDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  path?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalBytes?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  usedBytes?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  freeBytes?: number;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  usedPercent?: number | null;
}

export class DashboardDatabaseDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  latencyMs?: number;
}

export class DashboardRedisDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  latencyMs?: number | null;
}

export class DashboardWorkersDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  activeWorkers?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  runningJobs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  pendingJobs?: number;
}

export class ApiHistoryPointDto {
  @ApiProperty()
  @Expose()
  @IsString()
  at: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  value: number | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  sampleSize?: number;
}

export class DashboardApiDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  avgResponseTimeMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  sampleSize?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  windowSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  historyWindowSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsObject()
  byCategory?: Record<string, number>;

  @ApiProperty({ required: false, type: [ApiHistoryPointDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApiHistoryPointDto)
  history?: ApiHistoryPointDto[];
}

export class DashboardRoutePointDto {
  @ApiProperty()
  @Expose()
  @IsString()
  route: string;

  @ApiProperty()
  @Expose()
  @IsString()
  method: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  value: number;
}

export class DashboardRouteLatencyDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  windowStart?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  windowSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalRequestsRecent?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  avgResponseMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  errorRateRecent?: number;

  @ApiProperty({ required: false, type: [DashboardRoutePointDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardRoutePointDto)
  topSlowRoutes?: DashboardRoutePointDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  tenantScopeApplied?: boolean;
}

export class DashboardRouteErrorsDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  windowStart?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  windowSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalRequestsRecent?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalErrorCount?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  errorRateRecent?: number;

  @ApiProperty({ required: false, type: [DashboardRoutePointDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardRoutePointDto)
  topErrorRoutes?: DashboardRoutePointDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  tenantScopeApplied?: boolean;
}

export class DashboardSecurityIncidentDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  type: string;

  @ApiProperty()
  @Expose()
  @IsString()
  ip: string;

  @ApiProperty()
  @Expose()
  @IsString()
  at: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  path?: string;
}

export class DashboardSecurityDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false, type: [DashboardSecurityIncidentDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityIncidentDto)
  deniedAccess?: DashboardSecurityIncidentDto[];

  @ApiProperty({ required: false, type: [Object] })
  @Expose()
  @IsOptional()
  @IsArray()
  topDeniedIps?: Record<string, number>[];

  @ApiProperty({ required: false, type: [Object] })
  @Expose()
  @IsOptional()
  @IsArray()
  topRateLimitedIps?: Record<string, number>[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  maintenanceBypassAttemptsRecent?: number;

  @ApiProperty({ required: false, type: [DashboardSecurityIncidentDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityIncidentDto)
  accessDeniedRecent?: DashboardSecurityIncidentDto[];

  @ApiProperty({ required: false, type: [Object] })
  @Expose()
  @IsOptional()
  @IsArray()
  routeDistribution?: Record<string, number>[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  windowStart?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  windowSeconds?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  tenantScopeApplied?: boolean;
}

export class BackupSummaryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  fileName: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  sizeBytes: number;

  @ApiProperty()
  @Expose()
  @IsString()
  finishedAt: string;

  @ApiProperty()
  @Expose()
  @IsString()
  status: string;
}

export class DashboardBackupDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false, nullable: true, type: BackupSummaryDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => BackupSummaryDto)
  lastBackup?: BackupSummaryDto | null;

  @ApiProperty({ required: false, type: [BackupSummaryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupSummaryDto)
  recentBackups?: BackupSummaryDto[];
}

export class JobFailureSummaryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  type: string;

  @ApiProperty()
  @Expose()
  @IsString()
  finishedAt: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  error?: string | null;
}

export class DashboardJobsDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  running?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  pending?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  failedLast24h?: number;

  @ApiProperty({ required: false, nullable: true, type: JobFailureSummaryDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => JobFailureSummaryDto)
  lastFailure?: JobFailureSummaryDto | null;

  @ApiProperty({ required: false, type: [JobFailureSummaryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobFailureSummaryDto)
  recentFailures?: JobFailureSummaryDto[];
}

export class DashboardErrorEntryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  action: string;

  @ApiProperty()
  @Expose()
  @IsString()
  actionLabel: string;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;

  @ApiProperty()
  @Expose()
  @IsString()
  createdAt: string;
}

export class DashboardErrorsDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false, type: [DashboardErrorEntryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardErrorEntryDto)
  recent?: DashboardErrorEntryDto[];
}

export class DashboardTenantsDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  active?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  total?: number;
}

export class OperationalAlertDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  title: string;

  @ApiProperty()
  @Expose()
  @IsString()
  body: string;

  @ApiProperty()
  @Expose()
  @IsString()
  severity: string;

  @ApiProperty()
  @Expose()
  @IsString()
  createdAt: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  action?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  jobKey?: string | null;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isHistorical: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  currentState?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  resolutionSummary?: string | null;
}

export class DashboardNotificationsDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  criticalUnread?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  criticalRecent?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  operationalRecentCount?: number;

  @ApiProperty({ required: false, type: [OperationalAlertDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationalAlertDto)
  recentOperationalAlerts?: OperationalAlertDto[];
}

export class DashboardFiltersAppliedDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  periodMinutes: number;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  tenantId: string | null;

  @ApiProperty()
  @Expose()
  @IsString()
  severity: string;
}

export class DashboardWidgetsDto {
  @ApiProperty({ type: [String] })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  available: string[];
}

export class DashboardLayoutResponseDto {
  @ApiProperty({ enum: Role })
  @Expose()
  @IsEnum(Role)
  role: Role;

  @ApiProperty()
  @Expose()
  @IsObject()
  layoutJson: any;

  @ApiProperty()
  @Expose()
  @IsObject()
  filtersJson: any;

  @ApiProperty()
  @Expose()
  @IsDateString()
  updatedAt: string;
}

export class DashboardModuleCardsResponseDto {
  @ApiProperty()
  @Expose()
  @IsDateString()
  generatedAt: string;

  @ApiProperty({ type: [Object] })
  @Expose()
  @IsArray()
  cards: any[];

  @ApiProperty({ type: DashboardWidgetsDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardWidgetsDto)
  widgets: DashboardWidgetsDto;
}

export class SystemDashboardResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  generatedAt: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  responseTimeMs: number;

  @ApiProperty({ type: DashboardFiltersAppliedDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardFiltersAppliedDto)
  filtersApplied: DashboardFiltersAppliedDto;

  @ApiProperty({ type: DashboardVersionDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardVersionDto)
  version: DashboardVersionDto;

  @ApiProperty({ type: DashboardMaintenanceDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardMaintenanceDto)
  maintenance: DashboardMaintenanceDto;

  @ApiProperty({ type: DashboardSystemDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardSystemDto)
  system?: DashboardSystemDto;

  @ApiProperty({ type: DashboardCpuDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardCpuDto)
  cpu?: DashboardCpuDto;

  @ApiProperty({ type: DashboardMemoryDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardMemoryDto)
  memory?: DashboardMemoryDto;

  @ApiProperty({ type: DashboardDiskDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardDiskDto)
  disk?: DashboardDiskDto;

  @ApiProperty({ type: DashboardDatabaseDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardDatabaseDto)
  database?: DashboardDatabaseDto;

  @ApiProperty({ type: DashboardRedisDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardRedisDto)
  redis?: DashboardRedisDto;

  @ApiProperty({ type: DashboardWorkersDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardWorkersDto)
  workers?: DashboardWorkersDto;

  @ApiProperty({ type: DashboardApiDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardApiDto)
  api?: DashboardApiDto;

  @ApiProperty({ type: DashboardRouteLatencyDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardRouteLatencyDto)
  routeLatency?: DashboardRouteLatencyDto;

  @ApiProperty({ type: DashboardRouteErrorsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardRouteErrorsDto)
  routeErrors?: DashboardRouteErrorsDto;

  @ApiProperty({ type: DashboardSecurityDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardSecurityDto)
  security?: DashboardSecurityDto;

  @ApiProperty({ type: DashboardBackupDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardBackupDto)
  backup?: DashboardBackupDto;

  @ApiProperty({ type: DashboardJobsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardJobsDto)
  jobs?: DashboardJobsDto;

  @ApiProperty({ type: DashboardErrorsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardErrorsDto)
  errors?: DashboardErrorsDto;

  @ApiProperty({ type: DashboardTenantsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardTenantsDto)
  tenants?: DashboardTenantsDto;

  @ApiProperty({ type: DashboardNotificationsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardNotificationsDto)
  notifications?: DashboardNotificationsDto;

  @ApiProperty({ type: DashboardWidgetsDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardWidgetsDto)
  widgets: DashboardWidgetsDto;
}
