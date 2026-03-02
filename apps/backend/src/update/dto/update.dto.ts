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

  // Campo mantido apenas por compatibilidade de payload da UI.
  // O backend ignora este valor e sempre executa update com fluxo Docker controlado.
  @IsOptional()
  @IsString()
  packageManager?: string;
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
  @IsEnum(['docker', 'npm', 'pnpm', 'yarn'])
  packageManager?: string = 'docker';

  @IsOptional()
  updateCheckEnabled?: boolean = true;

  @IsOptional()
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'releaseTag deve seguir o formato semver (ex: v1.2.3 ou 1.2.3)',
  })
  releaseTag?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(docker-compose\.prod\.yml|docker-compose\.prod\.external\.yml)$/, {
    message: 'composeFile inválido. Use docker-compose.prod.yml ou docker-compose.prod.external.yml',
  })
  composeFile?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(install\/\.env\.production|\.env\.production|\.env)$/, {
    message: 'envFile inválido. Use install/.env.production, .env.production ou .env',
  })
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
