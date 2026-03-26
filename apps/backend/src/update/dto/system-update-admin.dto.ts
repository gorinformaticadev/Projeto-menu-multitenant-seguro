import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min, IsArray, IsObject, ValidateNested, IsNumber } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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

export class SystemUpdateResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  operationId: string;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;
}

export class SystemUpdateLogResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  tail: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  totalLines: number;

  @ApiProperty({ type: [String] })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  lines: string[];

  @ApiProperty()
  @Expose()
  @IsString()
  logPath: string;
}

export class ReleaseRowDto {
  @ApiProperty()
  @Expose()
  @IsString()
  name: string;

  @ApiProperty()
  @Expose()
  @IsString()
  path: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isPrevious: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  modifiedAt: string | null;
}

export class SystemUpdateReleasesResponseDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  current: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  previous: string | null;

  @ApiProperty({ type: [ReleaseRowDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReleaseRowDto)
  releases: ReleaseRowDto[];

  @ApiProperty()
  @Expose()
  @IsString()
  baseDir: string;
}
