import { IsString, IsBoolean, IsOptional, IsEnum, IsObject, ValidateNested, IsDateString } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
}

export class LoginResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED', 'REQUIRES_TWO_FACTOR', 'MUST_ENROLL_TWO_FACTOR'] })
  @Expose()
  @IsEnum(['AUTHENTICATED', 'REQUIRES_TWO_FACTOR', 'MUST_ENROLL_TWO_FACTOR'])
  status: 'AUTHENTICATED' | 'REQUIRES_TWO_FACTOR' | 'MUST_ENROLL_TWO_FACTOR';

  @ApiProperty()
  @Expose()
  @IsBoolean()
  authenticated: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requiresTwoFactor: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  mustEnrollTwoFactor: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  accessTokenExpiresAt?: string | null;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  refreshTokenExpiresAt?: string;

  @ApiProperty({ required: false, type: AuthUserResponseDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthUserResponseDto)
  user?: AuthUserResponseDto;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  enrollmentToken?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  enrollmentExpiresAt?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  trustedDeviceToken?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsDateString()
  trustedDeviceExpiresAt?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  clearTrustedDeviceCookie?: boolean;
}

export class LogoutResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  message?: string;
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

export class SimpleSuccessResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  message?: string;
}

export class EmailVerificationStatusResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  verifiedAt: string | null;
}
