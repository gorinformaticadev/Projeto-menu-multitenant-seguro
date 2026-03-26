import { IsString, IsEnum, IsBoolean, IsArray, IsNumber, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export type DiagnosticsLevel = 'healthy' | 'attention' | 'critical';

export class DiagnosticsOverallDto {
  @ApiProperty({ enum: ['healthy', 'attention', 'critical'] })
  @Expose()
  @IsEnum(['healthy', 'attention', 'critical'])
  level: DiagnosticsLevel;

  @ApiProperty()
  @Expose()
  @IsString()
  label: string;

  @ApiProperty()
  @Expose()
  @IsString()
  summary: string;

  @ApiProperty({ type: [String] })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  reasons: string[];

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  version: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  uptimeHuman: string | null;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  maintenanceActive: boolean;
}

export class DiagnosticsLinksDto {
  @ApiProperty()
  @Expose()
  @IsString()
  cron: string;

  @ApiProperty()
  @Expose()
  @IsString()
  logs: string;

  @ApiProperty()
  @Expose()
  @IsString()
  audit: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  updates: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  backups: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  notifications: string | null;
}

/**
 * Base para seções de diagnóstico
 */
export class BaseDiagnosticsSectionDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  @Expose()
  @IsEnum(['ok', 'error'])
  status: 'ok' | 'error';

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  message?: string;
}

export class OperationalDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  version?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  uptimeHuman?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  uptimeStartedAt?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  maintenanceActive?: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  maintenanceReason?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  maintenanceStartedAt?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  databaseStatus?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  redisStatus?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  apiErrorRateRecent?: number | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  criticalErrorsRecent?: number;
}

export class SchedulerProblemDto {
  @ApiProperty()
  @Expose()
  @IsString()
  key: string;

  @ApiProperty()
  @Expose()
  @IsString()
  name: string;

  @ApiProperty()
  @Expose()
  @IsString()
  schedule: string;

  @ApiProperty()
  @Expose()
  @IsString()
  type: string;

  @ApiProperty()
  @Expose()
  @IsString()
  summary: string;

  @ApiProperty()
  @Expose()
  @IsString()
  severity: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  nextExpectedRunAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  lastSucceededAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  lastFailedAt: string | null;
}

export class SchedulerDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  enabled?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  ok?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  running?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  failed?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  stale?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  stuck?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  missingRuntime?: number;

  @ApiProperty({ type: [SchedulerProblemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchedulerProblemDto)
  problematic?: SchedulerProblemDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string;
}

export class UpdateSummaryItemDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  version: string | null;

  @ApiProperty()
  @Expose()
  @IsString()
  status: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  startedAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  completedAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  durationSeconds: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  rollbackReason: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  errorMessage: string | null;
}

export class UpdateDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  currentVersion?: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  availableVersion?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  updateAvailable?: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  lastCheck?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  inProgress?: boolean;

  @ApiProperty({ nullable: true, type: UpdateSummaryItemDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSummaryItemDto)
  lastUpdate?: UpdateSummaryItemDto | null;

  @ApiProperty({ nullable: true, type: UpdateSummaryItemDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSummaryItemDto)
  lastRollback?: UpdateSummaryItemDto | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string | null;
}

export class BackupSummaryItemDto {
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
  status: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  fileName: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  createdAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  startedAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  finishedAt: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  error: string | null;
}

export class BackupDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ nullable: true, type: BackupSummaryItemDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => BackupSummaryItemDto)
  lastBackup?: BackupSummaryItemDto | null;

  @ApiProperty({ nullable: true, type: BackupSummaryItemDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => BackupSummaryItemDto)
  lastRestore?: BackupSummaryItemDto | null;

  @ApiProperty({ nullable: true, type: BackupSummaryItemDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => BackupSummaryItemDto)
  recentFailure?: BackupSummaryItemDto | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  pendingJobs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  runningJobs?: number;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string | null;
}

export class AlertSectionItemDto {
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
  source: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  action: string | null;
}

export class AlertsDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  recentCount?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  criticalCount?: number;

  @ApiProperty({ type: [AlertSectionItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlertSectionItemDto)
  recent?: AlertSectionItemDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  inboxAvailable?: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string | null;
}

export class AuditSectionItemDto {
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

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  message: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  severity: string | null;

  @ApiProperty()
  @Expose()
  @IsString()
  createdAt: string;
}

export class AuditDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ type: [AuditSectionItemDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditSectionItemDto)
  recent?: AuditSectionItemDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string;
}

export class TechnicalIssueDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  origin: string;

  @ApiProperty({ enum: ['error', 'warning'] })
  @Expose()
  @IsEnum(['error', 'warning'])
  level: 'error' | 'warning';

  @ApiProperty()
  @Expose()
  @IsString()
  title: string;

  @ApiProperty()
  @Expose()
  @IsString()
  occurredAt: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  detail: string | null;
}

export class LogsDiagnosticsSectionDto extends BaseDiagnosticsSectionDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  exists?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  pageAvailable?: boolean;

  @ApiProperty({ enum: ['auditoria-completa', 'auditoria-sistema'], required: false })
  @Expose()
  @IsOptional()
  @IsEnum(['auditoria-completa', 'auditoria-sistema'])
  pageKind?: 'auditoria-completa' | 'auditoria-sistema';

  @ApiProperty({ type: [String], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverage?: string[];

  @ApiProperty({ type: [String], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  limitations?: string[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ type: [TechnicalIssueDto], required: false })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalIssueDto)
  recentTechnicalIssues?: TechnicalIssueDto[];

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  href?: string;
}

export class SystemDiagnosticsResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  generatedAt: string;

  @ApiProperty({ enum: Role })
  @Expose()
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ type: DiagnosticsOverallDto })
  @Expose()
  @ValidateNested()
  @Type(() => DiagnosticsOverallDto)
  overall: DiagnosticsOverallDto;

  @ApiProperty({ type: DiagnosticsLinksDto })
  @Expose()
  @ValidateNested()
  @Type(() => DiagnosticsLinksDto)
  links: DiagnosticsLinksDto;

  @ApiProperty({ type: OperationalDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => OperationalDiagnosticsSectionDto)
  operational: OperationalDiagnosticsSectionDto;

  @ApiProperty({ type: SchedulerDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => SchedulerDiagnosticsSectionDto)
  scheduler: SchedulerDiagnosticsSectionDto;

  @ApiProperty({ type: UpdateDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => UpdateDiagnosticsSectionDto)
  update: UpdateDiagnosticsSectionDto;

  @ApiProperty({ type: BackupDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => BackupDiagnosticsSectionDto)
  backup: BackupDiagnosticsSectionDto;

  @ApiProperty({ type: AlertsDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => AlertsDiagnosticsSectionDto)
  alerts: AlertsDiagnosticsSectionDto;

  @ApiProperty({ type: AuditDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => AuditDiagnosticsSectionDto)
  audit: AuditDiagnosticsSectionDto;

  @ApiProperty({ type: LogsDiagnosticsSectionDto })
  @Expose()
  @ValidateNested()
  @Type(() => LogsDiagnosticsSectionDto)
  logs: LogsDiagnosticsSectionDto;
}
