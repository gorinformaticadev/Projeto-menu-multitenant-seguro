import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class RunSystemUpdateDto {
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'Versao deve seguir semver (ex: v1.2.3)',
  })
  version: string;

  @IsOptional()
  @IsBoolean()
  legacyInplace?: boolean;
}

export class RunSystemRollbackDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._+\-/]+$/, {
    message: 'target invalido',
  })
  target?: string;
}

export class SystemUpdateLogQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  tail?: number;
}

