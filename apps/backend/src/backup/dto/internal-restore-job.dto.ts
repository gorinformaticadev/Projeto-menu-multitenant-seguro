import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class InternalRestoreJobDto {
  @IsOptional()
  @IsBoolean()
  runMigrations?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class InternalRestoreByFileRequestDto extends InternalRestoreJobDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'backupFile invalido. Use apenas letras, numeros, ., _, -',
  })
  backupFile: string;
}

