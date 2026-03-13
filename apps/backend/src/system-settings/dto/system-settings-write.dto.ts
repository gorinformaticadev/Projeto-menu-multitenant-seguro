import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';
import { SystemSettingReadItemDto } from './system-settings-read.dto';

export class UpdateSystemSettingDto {
  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;
}

export class RestoreSystemSettingFallbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;
}

export class SystemSettingMutationResponseDto {
  action!: 'update' | 'restore_fallback';
  setting!: SystemSettingReadItemDto;
}
