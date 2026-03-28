import { IsString, IsOptional, Matches } from 'class-validator';

/**
 * DTO para execucao de atualizacao
 */
export class ExecuteUpdateDto {
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'Versao deve seguir o formato semver (ex: v1.2.3 ou 1.2.3)',
  })
  version: string;

  // Campo mantido apenas por compatibilidade de payload da UI.
  // O backend ignora este valor e detecta automaticamente o modo de instalacao.
  @IsOptional()
  @IsString()
  packageManager?: string;
}

/**
 * DTO para configuracao do sistema de updates
 */
export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'gitUsername deve conter apenas caracteres alfanuméricos, hífens ou underscores.' })
  gitUsername?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'gitRepository deve conter apenas caracteres alfanuméricos, hífens, underscores ou pontos.' })
  gitRepository?: string;

  @IsOptional()
  @IsString()
  gitToken?: string;

  @IsOptional()
  hasGitToken?: boolean;

  @IsOptional()
  @IsString()
  gitReleaseBranch?: string = 'main';

  @IsOptional()
  @IsString()
  packageManager?: string = 'docker';

  @IsOptional()
  @IsString()
  updateChannel?: 'release' | 'tag' = 'release';

  @IsOptional()
  updateCheckEnabled?: boolean = true;

  @IsOptional()
  @IsString()
  releaseTag?: string;

  @IsOptional()
  @IsString()
  composeFile?: string;

  @IsOptional()
  @IsString()
  envFile?: string;
}

/**
 * DTO de resposta para status do sistema
 */
export class UpdateStatusDto {
  currentVersion: string;
  availableVersion?: string;
  updateAvailable: boolean;
  lastCheck?: Date;
  isConfigured: boolean;
  checkEnabled: boolean;
  mode: 'docker' | 'native';
  updateChannel: 'release' | 'tag';
  updateLifecycle?: {
    status:
      | 'idle'
      | 'checking'
      | 'available'
      | 'not_available'
      | 'pending_confirmation'
      | 'starting'
      | 'running'
      | 'restarting_services'
      | 'completed'
      | 'failed';
    availabilityStatus: 'available' | 'not_available';
    rawStatus: 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';
    step: string;
    progress: number;
    progressPercent: number | null;
    progressKnown: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    mode: 'docker' | 'native';
    lock: boolean;
    stale: boolean;
    currentStep: {
      code: string;
      label: string;
      raw: string | null;
      source: string;
      detail: string | null;
      status: 'idle' | 'running' | 'completed' | 'failed' | 'unknown';
    } | null;
    lastCompletedStep: {
      code: string;
      label: string;
      raw: string | null;
      source: string;
      detail: string | null;
      status: 'idle' | 'running' | 'completed' | 'failed' | 'unknown';
    } | null;
    failedStep: {
      code: string;
      label: string;
      raw: string | null;
      source: string;
      detail: string | null;
      status: 'idle' | 'running' | 'completed' | 'failed' | 'unknown';
    } | null;
    operation: {
      active: boolean;
      operationId: string | null;
      type: 'update' | 'rollback' | null;
    };
    rollback: {
      attempted: boolean;
      completed: boolean;
      reason: string | null;
    };
    persistence: {
      healthy: boolean;
      source: string;
      fallbackApplied: boolean;
      progressKnown: boolean;
      statePath: string;
      logPath: string | null;
      issueCode: string | null;
      message: string | null;
      technicalMessage: string | null;
      rawExcerpt: string | null;
      recoveredStepCode: string | null;
    };
    persistenceError: {
      code: string;
      category: string;
      stage: string;
      userMessage: string;
      technicalMessage: string | null;
      exitCode: number | null;
    } | null;
    error: {
      code: string;
      category: string;
      stage: string;
      userMessage: string;
      technicalMessage: string | null;
      exitCode: number | null;
    } | null;
  };
}

/**
 * DTO de resposta para logs de atualizacao
 */
export class UpdateLogDto {
  id: string;
  version: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  packageManager: string;
  errorMessage?: string;
  rollbackReason?: string;
  executedBy?: string;
}
