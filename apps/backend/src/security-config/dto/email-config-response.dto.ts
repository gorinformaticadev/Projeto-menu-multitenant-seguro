import { IsString, IsInt, IsBoolean, IsOptional, IsArray, ValidateNested, IsDate } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EmailProviderInfoResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  providerName: string;

  @ApiProperty()
  @Expose()
  @IsString()
  smtpHost: string;

  @ApiProperty()
  @Expose()
  @IsInt()
  smtpPort: number;

  @ApiProperty()
  @Expose()
  @IsString()
  encryption: string;

  @ApiProperty()
  @Expose()
  @IsString()
  authMethod: string;

  @ApiProperty()
  @Expose()
  @IsString()
  description: string;
}

export class EmailConfigDetailsResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  providerName: string;

  @ApiProperty()
  @Expose()
  @IsString()
  smtpHost: string;

  @ApiProperty()
  @Expose()
  @IsInt()
  smtpPort: number;

  @ApiProperty()
  @Expose()
  @IsString()
  encryption: string;

  @ApiProperty()
  @Expose()
  @IsString()
  authMethod: string;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;
}

export class SmtpCredentialsResponseDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  smtpUsername: string | null;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  hasPassword: boolean;
}

export class EmailTestResponseDto {
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
