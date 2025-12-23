import { IsString, IsOptional, IsEnum, Matches } from 'class-validator';

/**
 * DTO para execução de atualização
 */
export class ExecuteUpdateDto {
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'Versão deve seguir o formato semver (ex: v1.2.3 ou 1.2.3)',
  })
  version: string;

  @IsOptional()
  @IsEnum(['npm', 'pnpm', 'yarn'], {
    message: 'Package manager deve ser npm, pnpm ou yarn',
  })
  packageManager?: string = 'npm';
}

/**
 * DTO para configuração do sistema de updates
 */
export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  gitUsername?: string;

  @IsOptional()
  @IsString()
  gitRepository?: string;

  @IsOptional()
  @IsString()
  gitToken?: string;

  @IsOptional()
  @IsString()
  gitReleaseBranch?: string = 'main';

  @IsOptional()
  @IsEnum(['npm', 'pnpm', 'yarn'])
  packageManager?: string = 'npm';

  @IsOptional()
  updateCheckEnabled?: boolean = true;
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
}

/**
 * DTO de resposta para logs de atualização
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