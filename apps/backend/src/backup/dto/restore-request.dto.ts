import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class RestoreRequestDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'backupFile invalido. Use apenas letras, numeros, ., _, -',
  })
  backupFile: string;

  @IsOptional()
  @IsBoolean()
  runMigrations?: boolean;

  @IsOptional()
  @IsEnum(['restore-only', 'drop-and-restore'])
  mode?: 'restore-only' | 'drop-and-restore';

  @IsOptional()
  @IsString()
  @Matches(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'targetReleaseTag deve seguir formato semver (ex: v1.2.3)',
  })
  targetReleaseTag?: string;
}
