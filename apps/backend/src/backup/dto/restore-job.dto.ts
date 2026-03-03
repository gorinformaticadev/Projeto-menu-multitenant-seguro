import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreJobDto {
  @IsOptional()
  @IsBoolean()
  runMigrations?: boolean;

  @IsOptional()
  @IsBoolean()
  forceCrossEnvironment?: boolean;

  @IsOptional()
  @IsBoolean()
  allowUnsafeObjects?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
