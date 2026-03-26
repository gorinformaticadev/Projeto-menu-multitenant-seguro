import { IsString } from 'class-validator';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SystemVersionResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  version: string;

  @ApiProperty()
  @Expose()
  @IsString()
  source: string;
}
