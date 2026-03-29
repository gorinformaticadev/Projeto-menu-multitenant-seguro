import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { UpdateExecutionMode, UpdateRollbackPolicy } from '../update-execution.types';

export class CreateUpdateExecutionDto {
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'Versao deve seguir semver (ex: v1.2.3)',
  })
  version: string;

  @IsOptional()
  @IsString()
  @IsIn(['native', 'docker'])
  mode?: UpdateExecutionMode;

  @IsOptional()
  @IsString()
  @IsIn(['code_only_safe', 'restore_required', 'manual_only'])
  rollbackPolicy?: UpdateRollbackPolicy;
}
