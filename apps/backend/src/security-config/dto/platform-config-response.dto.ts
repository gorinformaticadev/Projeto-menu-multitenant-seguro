import { IsString, IsOptional } from 'class-validator';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PlatformConfigResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  platformName: string;

  @ApiProperty()
  @Expose()
  @IsString()
  platformEmail: string;

  @ApiProperty()
  @Expose()
  @IsString()
  platformPhone: string;
}

export class PlatformNameResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  platformName: string;
}

export class PlatformEmailResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  platformEmail: string;
}

export class PlatformPhoneResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  platformPhone: string;
}
