import { IsString, IsBoolean, IsOptional, IsEnum, IsObject, ValidateNested, IsDateString } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AuthUserTenantDto {
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

export class AuthUserResponseDto {
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

  @ApiProperty()
  @Expose()
  @IsString()
  role: string;

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

  @ApiProperty({ type: AuthUserTenantDto, required: false, nullable: true })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthUserTenantDto)
  tenant?: AuthUserTenantDto | null;
}

export class LoginResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  accessToken: string;

  @ApiProperty()
  @Expose()
  @IsString()
  refreshToken: string;

  @ApiProperty({ type: AuthUserResponseDto })
  @Expose()
  @ValidateNested()
  @Type(() => AuthUserResponseDto)
  user: AuthUserResponseDto;
}

export class LogoutResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  message: string;
}

export class TwoFactorGenerateResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  secret: string;

  @ApiProperty()
  @Expose()
  @IsString()
  otpauthUrl: string;

  @ApiProperty()
  @Expose()
  @IsString()
  qrCode: string;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  suggested: boolean;
}

export class EmailVerificationStatusResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  verified: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsDateString()
  verifiedAt: string | null;
}

export class SimpleMessageResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  message: string;
}
