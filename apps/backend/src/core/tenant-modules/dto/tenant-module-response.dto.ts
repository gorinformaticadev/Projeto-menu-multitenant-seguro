import { IsString, IsBoolean, IsArray } from 'class-validator';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TenantModuleStatusResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  moduleName: string;

  @ApiProperty()
  @Expose()
  @IsString()
  tenantId: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  active: boolean;
}

export class TenantActiveModulesResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  tenantId: string;

  @ApiProperty({ type: [String] })
  @Expose()
  @IsArray()
  @IsString({ each: true })
  activeModules: string[];
}

export class SimpleMessageResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  message: string;
}
