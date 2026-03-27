import { IsString, IsBoolean, IsOptional, IsEnum, Matches, IsDate, IsNumber, ValidateNested, IsObject, IsArray } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para execucao de atualizacao
 */
export class ExecuteUpdateDto {
  @ApiProperty({ description: 'Versão alvo do update' })
  @Expose()
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'Versao deve seguir o formato semver (ex: v1.2.3 ou 1.2.3)',
  })
  version: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  packageManager?: string;
}

/**
 * DTO para resposta de execucao de atualizacao
 */
export class ExecuteUpdateResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  logId: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  operationId?: string;

  @ApiProperty()
  @Expose()
  @IsString()
  status: string;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;
}

/**
 * DTO para configuracao do sistema de updates
 */
export class UpdateConfigDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'gitUsername deve conter apenas caracteres alfanuméricos, hífens ou underscores.' })
  gitUsername?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'gitRepository deve conter apenas caracteres alfanuméricos, hífens, underscores ou pontos.' })
  gitRepository?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  gitToken?: string;

  @ApiProperty({ required: false, default: 'main' })
  @Expose()
  @IsOptional()
  @IsString()
  gitReleaseBranch?: string = 'main';

  @ApiProperty({ required: false, default: 'docker' })
  @Expose()
  @IsOptional()
  @IsString()
  packageManager?: string = 'docker';

  @ApiProperty({ required: false, enum: ['release', 'tag'], default: 'release' })
  @Expose()
  @IsOptional()
  @IsString()
  updateChannel?: 'release' | 'tag' = 'release';

  @ApiProperty({ required: false, default: true })
  @Expose()
  @IsOptional()
  @IsBoolean()
  updateCheckEnabled?: boolean = true;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  releaseTag?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  composeFile?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  envFile?: string;
}

export class UpdateLifecycleOperationDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  active: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  operationId: string | null;

  @ApiProperty({ enum: ['update', 'rollback'], nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  @IsEnum(['update', 'rollback'])
  type: 'update' | 'rollback' | null;
}

export class UpdateLifecycleRollbackDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  attempted: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  completed: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  reason: string | null;
}

export class UpdateLifecycleErrorDto {
  @ApiProperty()
  @Expose()
  @IsString()
  code: string;

  @ApiProperty()
  @Expose()
  @IsString()
  category: string;

  @ApiProperty()
  @Expose()
  @IsString()
  stage: string;

  @ApiProperty()
  @Expose()
  @IsString()
  userMessage: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  technicalMessage: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsNumber()
  exitCode: number | null;
}

export class UpdateLifecycleDto {
  @ApiProperty()
  @Expose()
  @IsEnum([
    'idle',
    'checking',
    'available',
    'not_available',
    'pending_confirmation',
    'starting',
    'running',
    'restarting_services',
    'completed',
    'failed',
  ])
  status: string;

  @ApiProperty()
  @Expose()
  @IsEnum(['available', 'not_available'])
  availabilityStatus: string;

  @ApiProperty()
  @Expose()
  @IsEnum(['idle', 'running', 'success', 'failed', 'rolled_back'])
  rawStatus: string;

  @ApiProperty()
  @Expose()
  @IsString()
  step: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  progress: number;

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

  @ApiProperty()
  @Expose()
  @IsEnum(['docker', 'native'])
  mode: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  lock: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  stale: boolean;

  @ApiProperty({ type: UpdateLifecycleOperationDto })
  @Expose()
  @ValidateNested()
  @Type(() => UpdateLifecycleOperationDto)
  operation: UpdateLifecycleOperationDto;

  @ApiProperty({ type: UpdateLifecycleRollbackDto })
  @Expose()
  @ValidateNested()
  @Type(() => UpdateLifecycleRollbackDto)
  rollback: UpdateLifecycleRollbackDto;

  @ApiProperty({ type: UpdateLifecycleErrorDto, nullable: true })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLifecycleErrorDto)
  error: UpdateLifecycleErrorDto | null;
}

/**
 * DTO de resposta para status do sistema
 */
export class UpdateStatusDto {
  @ApiProperty()
  @Expose()
  @IsString()
  currentVersion: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  availableVersion?: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  updateAvailable: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lastCheck?: Date;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isConfigured: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  checkEnabled: boolean;

  @ApiProperty({ enum: ['docker', 'native'] })
  @Expose()
  @IsEnum(['docker', 'native'])
  mode: 'docker' | 'native';

  @ApiProperty({ enum: ['release', 'tag'] })
  @Expose()
  @IsEnum(['release', 'tag'])
  updateChannel: 'release' | 'tag';

  @ApiProperty({ type: UpdateLifecycleDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLifecycleDto)
  updateLifecycle?: UpdateLifecycleDto;
}

/**
 * DTO de resposta para logs de atualizacao
 */
export class UpdateLogDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  version: string;

  @ApiProperty()
  @Expose()
  @IsString()
  status: string;

  @ApiProperty()
  @Expose()
  @IsDate()
  @Type(() => Date)
  startedAt: Date;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiProperty()
  @Expose()
  @IsString()
  packageManager: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  rollbackReason?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  executedBy?: string;
}

export class CheckUpdateResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  updateAvailable: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  availableVersion?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  currentVersion?: string;
}

export class UpdateLogDetailsResponseDto {
  @ApiProperty({ type: [String] })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  lines: string[];

  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;
}

export class ConnectionTestDetailsDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConnectionTestResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;

  @ApiProperty({ required: false, type: ConnectionTestDetailsDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionTestDetailsDto)
  details?: ConnectionTestDetailsDto;
}
