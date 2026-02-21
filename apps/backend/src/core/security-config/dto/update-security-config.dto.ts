import { IsInt, IsBoolean, IsString, IsOptional, Min, Max } from 'class-validator';

export class UpdateSecurityConfigDto {
  // Rate Limiting (Desenvolvimento e Produção)
  @IsOptional()
  @IsBoolean()
  rateLimitDevEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rateLimitProdEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimitDevRequests?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimitProdRequests?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  rateLimitDevWindow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  rateLimitProdWindow?: number;

  // Rate Limiting
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  loginMaxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440) // Até 24 horas
  loginLockDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  loginWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  globalMaxRequests?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  globalWindowMinutes?: number;

  // Senha
  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(32)
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireSpecial?: boolean;

  // JWT
  @IsOptional()
  @IsString()
  accessTokenExpiresIn?: string;

  @IsOptional()
  @IsString()
  refreshTokenExpiresIn?: string;

  // 2FA
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorRequiredForAdmins?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorSuggested?: boolean;

  // Email Verification
  @IsOptional()
  @IsBoolean()
  emailVerificationRequired?: boolean;

  @IsOptional()
  @IsString()
  emailVerificationLevel?: string; // SOFT, MODERATE, STRICT

  // Password Policy
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  passwordReuseLimit?: number;

  // Sessão
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440) // Até 24 horas
  sessionTimeoutMinutes?: number;

  // SMTP Credentials
  @IsOptional()
  @IsString()
  smtpUsername?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  // Platform Configuration
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsString()
  platformEmail?: string;

  @IsOptional()
  @IsString()
  platformPhone?: string;
}