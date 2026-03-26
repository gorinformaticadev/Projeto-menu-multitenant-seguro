import { IsString, IsBoolean, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString, IsNumber } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserTenantResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  nomeFantasia?: string;
}

export class UserResponseDto {
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
  name: string;

  @ApiProperty({ enum: Role })
  @Expose()
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  tenantId: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isLocked: boolean;

  @ApiProperty()
  @Expose()
  @IsNumber()
  loginAttempts: number;

  @ApiProperty()
  @Expose()
  @IsDateString()
  createdAt: string;

  @ApiProperty()
  @Expose()
  @IsDateString()
  updatedAt: string;

  @ApiProperty({ type: UserTenantResponseDto, required: false, nullable: true })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UserTenantResponseDto)
  tenant?: UserTenantResponseDto | null;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserResponseDto)
  users: UserResponseDto[];

  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;
}
