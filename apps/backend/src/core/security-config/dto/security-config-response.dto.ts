import { IsString, IsBoolean, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SecurityConfigResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  rateLimitDevEnabled: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  rateLimitProdEnabled: boolean;

  @ApiProperty()
  @Expose()
  @IsNumber()
  rateLimitDevRequests: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  rateLimitProdRequests: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  rateLimitDevWindow: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  rateLimitProdWindow: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  loginMaxAttempts: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  loginLockDurationMinutes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  loginWindowMinutes: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  passwordMinLength: number;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireUppercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireLowercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireNumbers: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireSpecial: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  accessTokenExpiresIn: string;

  @ApiProperty()
  @Expose()
  @IsString()
  refreshTokenExpiresIn: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorEnabled: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorRequired: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorRequiredForAdmins: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorSuggested: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  webPushPublicKey?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  webPushSubject?: string | null;
}

export class WebPushConfigResponseDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  publicKey: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  subject: string | null;
}

export class PasswordPolicyResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  minLength: number;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requireUppercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requireLowercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requireNumbers: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requireSpecial: boolean;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  required: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  requiredForAdmins: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  suggested: boolean;
}

export class FullSecurityConfigResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorEnabled: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorRequired: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorRequiredForAdmins: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  twoFactorSuggested: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  emailVerificationRequired: boolean;

  @ApiProperty()
  @Expose()
  @IsString()
  emailVerificationLevel: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  passwordMinLength: number;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireUppercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireLowercase: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireNumbers: boolean;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  passwordRequireSpecial: boolean;

  @ApiProperty()
  @Expose()
  @IsNumber()
  sessionTimeoutMinutes: number;
}
