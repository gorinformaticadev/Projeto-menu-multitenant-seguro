import { IsString, IsBoolean, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TenantCountResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  users: number;
}

export class TenantResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  email: string;

  @ApiProperty()
  @Expose()
  @IsString()
  cnpjCpf: string;

  @ApiProperty()
  @Expose()
  @IsString()
  nomeFantasia: string;

  @ApiProperty()
  @Expose()
  @IsString()
  nomeResponsavel: string;

  @ApiProperty()
  @Expose()
  @IsString()
  telefone: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  @IsDateString()
  createdAt: string;

  @ApiProperty()
  @Expose()
  @IsDateString()
  updatedAt: string;

  @ApiProperty({ type: TenantCountResponseDto })
  @Expose()
  @ValidateNested()
  @Type(() => TenantCountResponseDto)
  _count: TenantCountResponseDto;
}

export class TenantLogoResponseDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  logo: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  url?: string;
}

export class TenantModuleItemDto {
  @ApiProperty()
  @Expose()
  @IsString()
  name: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isActive: boolean;
}

export class TenantModulesResponseDto {
  @ApiProperty({ type: [TenantModuleItemDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantModuleItemDto)
  modules: TenantModuleItemDto[];

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
