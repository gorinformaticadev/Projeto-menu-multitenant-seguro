import { IsString, IsBoolean, IsOptional, IsEnum, IsDate, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CronJobDatabaseLeaseOptionsDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  ttlMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  renewIntervalMs?: number;
}

export class CronJobDto {
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
  description: string;

  @ApiProperty()
  @Expose()
  @IsString()
  schedule: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  idempotent?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastRun?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextRun?: Date | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  settingsUrl?: string;

  @ApiProperty({ required: false, enum: ['core', 'modulo'] })
  @Expose()
  @IsOptional()
  @IsEnum(['core', 'modulo'])
  origin?: 'core' | 'modulo';

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  editable?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  runtimeRegistered?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  runtimeActive?: boolean;

  @ApiProperty({ required: false, enum: ['database'] })
  @Expose()
  @IsOptional()
  @IsEnum(['database'])
  sourceOfTruth?: 'database';

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastStartedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastHeartbeatAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastSucceededAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastFailedAt?: Date | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  lastDurationMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  lastStatus?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  lastError?: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextExpectedRunAt?: Date | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  consecutiveFailureCount?: number;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  issue?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  watchdogEnabled?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  watchdogStaleAfterMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  watchdogStuckAfterMs?: number;

  @ApiProperty({ type: CronJobDatabaseLeaseOptionsDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => CronJobDatabaseLeaseOptionsDto)
  databaseLease?: CronJobDatabaseLeaseOptionsDto;

  @ApiProperty({ required: false, enum: ['direct', 'materialized'] })
  @Expose()
  @IsOptional()
  @IsEnum(['direct', 'materialized'])
  executionMode?: 'direct' | 'materialized';
}

export class RuntimeCronJobDto {
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
  @IsBoolean()
  running: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastDate?: Date | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextDate?: Date | null;
}

export class SimpleSuccessResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  message?: string;
}

export class CronToggleResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  enabled: boolean;
}

export class CronScheduleResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  schedule: string;
}
