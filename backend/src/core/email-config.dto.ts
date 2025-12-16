import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export enum EmailProvider {
  GMAIL = 'Gmail',
  HOTMAIL = 'Hotmail/Outlook',
  TITAN = 'Titan',
}

export class CreateEmailConfigDto {
  @IsString()
  providerName: string;

  @IsString()
  smtpHost: string;

  @IsInt()
  smtpPort: number;

  @IsString()
  encryption: string;

  @IsString()
  authMethod: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class UpdateEmailConfigDto {
  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  encryption?: string;

  @IsOptional()
  @IsString()
  authMethod?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class EmailConfigResponseDto {
  id: string;
  providerName: string;
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  authMethod: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}