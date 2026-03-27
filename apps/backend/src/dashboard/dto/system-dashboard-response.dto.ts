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

export class DashboardRouteTelemetryDto {
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
  requestCount: number;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  avgMs: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  p95Ms: number | null;

  @ApiProperty()
  @Expose()
  @IsNumber()
  errorCount: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  errorRate: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  status2xx: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  status4xx: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  status5xx: number;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  lastErrorAt: string | null;
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

  @ApiProperty({ required: false, type: [DashboardRouteTelemetryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardRouteTelemetryDto)
  topSlowRoutes?: DashboardRouteTelemetryDto[];

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

  @ApiProperty({ required: false, type: [DashboardRouteTelemetryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardRouteTelemetryDto)
  topErrorRoutes?: DashboardRouteTelemetryDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  tenantScopeApplied?: boolean;
}

export class DashboardContractOriginDto {
  @ApiProperty()
  @Expose()
  @IsString()
  origin: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  validationFailed: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  payloadStripped: number;

  @ApiProperty()
  @Expose()
  @IsString()
  denominatorKind: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  denominatorCount: number;
}

export class DashboardContractMinuteDto {
  @ApiProperty()
  @Expose()
  @IsString()
  minuteStart: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  validationFailed: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  payloadStripped: number;
}

export class DashboardContractRouteDto {
  @ApiProperty()
  @Expose()
  @IsString()
  route: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  method?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  module?: string | null;

  @ApiProperty()
  @Expose()
  @IsString()
  origin: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  validationFailed: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  payloadStripped: number;
}

export class DashboardContractDtoEntryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  dto: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  validationFailed: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  payloadStripped: number;
}

export class DashboardContractObservabilityDto extends DashboardMetricStatusDto {
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
  totalEvents?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalValidationErrors?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  totalPayloadStrips?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  failureRatePerThousandRequests?: number | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  wsFailureRatePerThousandEvents?: number | null;

  @ApiProperty({ required: false, type: [DashboardContractOriginDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardContractOriginDto)
  byOrigin?: DashboardContractOriginDto[];

  @ApiProperty({ required: false, type: [DashboardContractRouteDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardContractRouteDto)
  topRoutes?: DashboardContractRouteDto[];

  @ApiProperty({ required: false, type: [DashboardContractDtoEntryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardContractDtoEntryDto)
  topDtos?: DashboardContractDtoEntryDto[];

  @ApiProperty({ required: false, type: [DashboardContractMinuteDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardContractMinuteDto)
  eventsPerMinute?: DashboardContractMinuteDto[];

  @ApiProperty({ required: false, type: Object })
  @Expose()
  @IsOptional()
  @IsObject()
  trends?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  @IsOptional()
  @IsObject()
  severity?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  @IsOptional()
  @IsObject()
  persistence?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  @Expose()
  @IsOptional()
  @IsObject()
  cardinality?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object, nullable: true })
  @Expose()
  @IsOptional()
  @IsObject()
  calibration?: Record<string, unknown> | null;
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

export class DashboardSecurityIpSummaryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  ip: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;

  @ApiProperty()
  @Expose()
  @IsString()
  lastSeenAt: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  route: string | null;
}

export class DashboardSecurityRecentEventDto {
  @ApiProperty()
  @Expose()
  @IsString()
  type: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  statusCode: number;

  @ApiProperty()
  @Expose()
  @IsString()
  method: string;

  @ApiProperty()
  @Expose()
  @IsString()
  route: string;

  @ApiProperty()
  @Expose()
  @IsString()
  ip: string;

  @ApiProperty()
  @Expose()
  @IsString()
  at: string;
}

export class DashboardSecurityRouteCountDto {
  @ApiProperty()
  @Expose()
  @IsString()
  route: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;
}

export class DashboardSecurityDto extends DashboardMetricStatusDto {
  @ApiProperty({ required: false, type: [DashboardSecurityIpSummaryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityIpSummaryDto)
  deniedAccess?: DashboardSecurityIpSummaryDto[];

  @ApiProperty({ required: false, type: [DashboardSecurityIpSummaryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityIpSummaryDto)
  topDeniedIps?: DashboardSecurityIpSummaryDto[];

  @ApiProperty({ required: false, type: [DashboardSecurityIpSummaryDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityIpSummaryDto)
  topRateLimitedIps?: DashboardSecurityIpSummaryDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  maintenanceBypassAttemptsRecent?: number;

  @ApiProperty({ required: false, type: [DashboardSecurityRecentEventDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityRecentEventDto)
  accessDeniedRecent?: DashboardSecurityRecentEventDto[];

  @ApiProperty({ required: false, type: [DashboardSecurityRouteCountDto] })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardSecurityRouteCountDto)
  routeDistribution?: DashboardSecurityRouteCountDto[];

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

export class GridItemDto {
  @ApiProperty()
  @Expose()
  @IsString()
  i: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  x: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  y: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  w: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  h: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  static?: boolean;
}

export class DashboardLayoutDataDto {
  @ApiProperty({ type: [GridItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  lg?: GridItemDto[];

  @ApiProperty({ type: [GridItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  md?: GridItemDto[];

  @ApiProperty({ type: [GridItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  sm?: GridItemDto[];

  @ApiProperty({ type: [GridItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  xs?: GridItemDto[];

  @ApiProperty({ type: [GridItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  xxs?: GridItemDto[];
}

export class DashboardFiltersJsonDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  periodMinutes?: number;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  tenantId?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  operationalPinned?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenWidgetIds?: string[];
}

export class ModuleCardStatDto {
  @ApiProperty()
  @Expose()
  @IsString()
  label: string;

  @ApiProperty()
  @Expose()
  @IsString()
  value: string;
}

export class ModuleCardItemEntryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  label: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  column?: string;

  @ApiProperty({ required: false, enum: ['neutral', 'good', 'warn', 'danger'] })
  @Expose()
  @IsOptional()
  @IsString()
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}

export class ModuleCardItemDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty()
  @Expose()
  @IsString()
  module: string;

  @ApiProperty({ enum: Role, required: false })
  @Expose()
  @IsOptional()
  @IsEnum(Role)
  visibilityRole?: Role;

  @ApiProperty({ required: false, enum: ['summary', 'list', 'kanban'] })
  @Expose()
  @IsOptional()
  @IsString()
  kind?: 'summary' | 'list' | 'kanban';

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  actionLabel?: string | null;

  @ApiProperty({ required: false, enum: ['small', 'medium', 'large'] })
  @Expose()
  @IsOptional()
  @IsString()
  size?: 'small' | 'medium' | 'large';

  @ApiProperty({ type: [ModuleCardStatDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleCardStatDto)
  stats?: ModuleCardStatDto[];

  @ApiProperty({ type: [ModuleCardItemEntryDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleCardItemEntryDto)
  items?: ModuleCardItemEntryDto[];
}

export class DashboardLayoutResponseDto {
  @ApiProperty({ enum: Role })
  @Expose()
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ type: DashboardLayoutDataDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardLayoutDataDto)
  layoutJson: DashboardLayoutDataDto;

  @ApiProperty({ type: DashboardFiltersJsonDto })
  @Expose()
  @ValidateNested()
  @Type(() => DashboardFiltersJsonDto)
  filtersJson: DashboardFiltersJsonDto;

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

  @ApiProperty({ type: [ModuleCardItemDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleCardItemDto)
  cards: ModuleCardItemDto[];

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

  @ApiProperty({ type: DashboardContractObservabilityDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardContractObservabilityDto)
  contractObservability?: DashboardContractObservabilityDto;

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
